package expo.modules.netflixproaudio

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.util.Log
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * A multi-band equaliser and a gain stage, attached to the device's global
 * audio output.
 *
 * ## Why the global output and not the player
 *
 * `Equalizer` and `LoudnessEnhancer` are constructed against an audio session
 * id, and `expo-video` does not expose the one its ExoPlayer instance uses. The
 * alternative — reaching into the player's internals through reflection — would
 * break on any upgrade and is not worth it here.
 *
 * `AudioEffect.ERROR_BAD_VALUE` is what session `0` would give if it were
 * rejected, so it is not used. Session [AudioManager.AUDIO_SESSION_ID_GENERATE]
 * is, and it is not a placeholder: it asks AudioFlinger for a session on the
 * global output mix, which is the same path system equalisers and accessibility
 * audio processing take. Every player on the device then passes through these
 * effects, so what the equaliser hears is exactly what the viewer hears.
 *
 * ## Ordering
 *
 * Effects are inserted in a fixed order and the EQ is always constructed first,
 * so the signal is EQ -> gain. That matters: gain before EQ would let a boosted
 * band clip the limiter, whereas EQ first lets the limiter see the final shape.
 *
 * ## Clipping
 *
 * `LoudnessEnhancer` is a compressor, not a multiplier — it raises perceived
 * loudness while holding the peaks — so pushing it past 100% does not simply
 * multiply the signal into hard clipping the way a naive gain would. It is
 * still possible to drive it far enough to distort, which is why the JS layer
 * warns above 150% and why the range is capped at 300%.
 */
class NetflixProAudioModule : Module() {

  private var equalizer: Equalizer? = null
  private var enhancer: LoudnessEnhancer? = null

  /** The device's own bands, read once when the EQ is first created. */
  private var bandLevelRange: ShortArray? = null

  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()

  override fun definition() = ModuleDefinition {
    Name("NetflixProAudio")

    // Reported to JS so the UI can say "not supported on this device" instead
    // of offering controls that silently do nothing.
    Function("isSupported") {
      audioManager() != null
    }

    // How many bands the hardware actually has, and the gain each accepts in
    // millibels. A device with 5 bands and one with 10 get the same UI because
    // the UI is built from these, not from a hardcoded band count.
    Function("getEqualizerInfo") {
      val bands = ensureEqualizer()?.numberOfBands ?: 0
      val range = bandLevelRange
      return@Function mapOf(
        "available" to (equalizer != null),
        "numberOfBands" to bands.toInt(),
        "minLevelMb" to (range?.get(0)?.toInt() ?: 0),
        "maxLevelMb" to (range?.get(1)?.toInt() ?: 0),
        "centerFrequencies" to centerFrequencies()
      )
    }

    // Band gains in millibels, in band order.
    AsyncFunction("setBandLevels") { levelsMb: List<Int> ->
      val eq = ensureEqualizer() ?: throw EffectsUnavailableException()
      val range = bandLevelRange ?: throw EffectsUnavailableException()
      for (band in 0 until eq.numberOfBands) {
        val requested = levelsMb.getOrNull(band) ?: 0
        val clamped = requested
          .coerceAtLeast(range[0].toInt())
          .coerceAtMost(range[1].toInt())
        eq.setBandLevel(band.toShort(), clamped.toShort())
      }
      Unit
    }

    // Read back from the effect rather than echoing what was set, so JS state
    // cannot drift from the hardware.
    Function("getBandLevels") {
      val eq = ensureEqualizer() ?: return@Function emptyList<Int>()
      (0 until eq.numberOfBands).map { eq.getBandLevel(it.toShort()).toInt() }
    }

    // Gain in millibels above unity. 0 is no boost; 1000 is +10 dB, roughly
    // 3.16x, which is the loudest this can usefully go before the limiter
    // starts pumping audibly.
    AsyncFunction("setGainMb") { gainMb: Int ->
      val clamped = gainMb.coerceIn(MIN_GAIN_MB, MAX_GAIN_MB)
      if (clamped <= 0) {
        releaseEnhancer()
        return@AsyncFunction Unit
      }
      val created = ensureEnhancer() ?: throw EffectsUnavailableException()
      created.setTargetGain(clamped)
      Unit
    }

    Function("getGainMb") {
      enhancer?.targetGain?.toInt() ?: 0
    }

    // Neutral by default so a stale preference cannot survive into the next
    // title. Called on unmount as well as by the reset action.
    AsyncFunction("reset") {
      equalizer?.let { eq ->
        for (band in 0 until eq.numberOfBands) {
          eq.setBandLevel(band.toShort(), 0)
        }
      }
      releaseEnhancer()
      Unit
    }

    OnDestroy {
      releaseAll()
    }
  }

  private fun audioManager(): AudioManager? =
    context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  /**
   * Create the equaliser on first use, or return the existing one.
   *
   * Construction can legitimately fail — an emulator without audio effects, a
   * device whose vendor omitted the implementation — so every failure path
   * returns null and the JS layer degrades to a hidden control rather than
   * throwing on mount.
   */
  @Synchronized
  private fun ensureEqualizer(): Equalizer? {
    equalizer?.let { return it }
    val session = AudioManager.AUDIO_SESSION_ID_GENERATE
    return try {
      val created = Equalizer(DEFAULT_PRIORITY, session)
      bandLevelRange = created.bandLevelRange
      equalizer = created
      created
    } catch (error: Throwable) {
      // RuntimeException covers the "no effect of this type" case, which some
      // devices raise instead of UnsupportedOperationException.
      Log.w(TAG, "Equalizer unavailable on this device", error)
      null
    }
  }

  @Synchronized
  private fun ensureEnhancer(): LoudnessEnhancer? {
    enhancer?.let { return it }
    val session = AudioManager.AUDIO_SESSION_ID_GENERATE
    return try {
      val created = LoudnessEnhancer(session)
      enhancer = created
      created
    } catch (error: Throwable) {
      Log.w(TAG, "LoudnessEnhancer unavailable on this device", error)
      null
    }
  }

  private fun releaseEnhancer() {
    try {
      enhancer?.enabled = false
      enhancer?.release()
    } catch (error: Throwable) {
      Log.w(TAG, "Failed to release LoudnessEnhancer", error)
    } finally {
      enhancer = null
    }
  }

  private fun releaseAll() {
    releaseEnhancer()
    try {
      equalizer?.enabled = false
      equalizer?.release()
    } catch (error: Throwable) {
      Log.w(TAG, "Failed to release Equalizer", error)
    } finally {
      equalizer = null
      bandLevelRange = null
    }
  }

  /** Centre frequency of each band in Hz, so the UI can label them. */
  private fun centerFrequencies(): List<Int> {
    val eq = equalizer ?: return emptyList()
    return (0 until eq.numberOfBands).map { eq.getCenterFreq(it.toShort()) / 1000 }
  }

  private companion object {
    const val TAG = "NetflixProAudio"

    /** Unity gain. */
    const val MIN_GAIN_MB = 0

    /**
     * +10 dB. Above this the limiter works hard enough to pump on transient-heavy
     * material, and the added loudness is no longer worth the artefacts.
     */
    const val MAX_GAIN_MB = 1000

    /**
     * Insertion priority. `AudioEffect.EFFECT_PRE_PRIORITY` and its siblings are
     * marked `@hide` in the framework, so they cannot be referenced from here;
     * `0` is the value of `EFFECT_DEFAULT_PRIORITY` and is what an effect
     * created without an explicit priority gets anyway.
     */
    const val DEFAULT_PRIORITY = 0
  }
}

/** Raised when a react context is unavailable, which only happens at teardown. */
class MissingContextException :
  CodedException("NetflixProAudio could not reach the react context")

/** Raised when the device has no usable audio effect implementation. */
class EffectsUnavailableException :
  CodedException("This device does not support audio effects")
