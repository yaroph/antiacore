/**
 * single-audio-guard.js
 * Ensures only one audio plays at a time across the whole page/app.
 * - Pauses & rewinds any previous audio when a new one starts.
 * - Works for <audio> elements and programmatically created HTMLMediaElements (new Audio()).
 * - Also defends when libraries call media.play().
 */
(function () {
  try {
    // Track the currently playing media element
    var current = null;

    // Hook into the native play() so we can intercept programmatic plays
    var proto = HTMLMediaElement && HTMLMediaElement.prototype;
    if (proto && !proto.__singleAudioGuardPatched) {
      var _play = proto.play;
      proto.play = function () {
        try {
          if (current && current !== this) {
            // Pause and reset previous media
            try { current.pause(); } catch (e) {}
            try { current.currentTime = 0; } catch (e) {}
          }
          current = this;
        } catch (e) {}
        return _play.apply(this, arguments);
      };
      proto.__singleAudioGuardPatched = true;
    }

    // Also listen for 'play' events coming from user interaction
    // (helps when a media starts without calling play on the prototype due to browser quirks)
    document.addEventListener('play', function (e) {
      var target = e.target;
      if (!target || typeof target.pause !== "function") return;
      if (current && current !== target) {
        try { current.pause(); } catch (e) {}
        try { current.currentTime = 0; } catch (e) {}
      }
      current = target;
    }, true);
  } catch (err) {
    // Fail-safe: don't break the page if anything goes wrong
    console && console.warn && console.warn("[single-audio-guard] Non-breaking error:", err);
  }
})();
