// Sets the theme class on <html> before first paint. Kept as an external file
// so the Content-Security-Policy can stay strict (no inline scripts).
// Storage key and class name must match useTheme: key "theme", class "dark".
// Dark is the default; only an explicit stored "light" switches it off.
(function () {
  var dark = true
  try {
    var stored = window.localStorage.getItem('theme')
    if (stored !== null) {
      // useLocalStorage may store JSON ("light") or a bare string (light).
      var value = stored
      try {
        value = JSON.parse(stored)
      } catch (_) {
        value = stored
      }
      if (value === 'light') dark = false
    }
  } catch (_) {
    // Storage unavailable: keep the dark default.
  }
  var root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
})()
