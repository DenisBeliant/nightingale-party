package cafe.nightingale.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

/**
 * Nightingale in a full-screen WebView: the TV's system Chromium, kept up to
 * date by Google Play. The page runs in "TV mode" (`?tv=1`), which shows the
 * party screen ("Jouer") only. The remote's Back
 * button goes to the page first (pause menu during a song, closing dialogs),
 * then back through the app's pages, and leaves on a double press at home.
 */
class WebActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var baseUrl: String
    private var lastBackAt = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        baseUrl = intent.getStringExtra(EXTRA_URL) ?: run {
            backToPicker()
            return
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val debuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        web = WebView(this).apply {
            setBackgroundColor(Color.rgb(13, 13, 22))
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                // Songs start from the remote, not from a tap on the page.
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = false
                setSupportZoom(false)
                userAgentString = "$userAgentString NightingaleTV/${appVersion()}"
            }
            webViewClient = StayOnServer()
            webChromeClient = object : WebChromeClient() {
                // The TV has no microphone to give: phones sing in party mode.
                override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            }
        }
        setContentView(web)
        hideSystemBars()

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(withTvFlag(baseUrl))
        }
        web.requestFocus()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        if (::web.isInitialized) {
            web.destroy()
        }
        super.onDestroy()
    }

    // ── Remote keys ────────────────────────────────────────────────────────

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> {
                if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                    handleBack()
                }
                return true
            }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> {
                // Menu: switch to another server.
                if (event.action == KeyEvent.ACTION_UP) {
                    backToPicker()
                }
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun handleBack() {
        web.evaluateJavascript(PAGE_BACK_SCRIPT) { result ->
            when (result?.trim('"')) {
                "handled" -> Unit
                "home" -> confirmExit()
                else -> if (web.canGoBack()) web.goBack() else web.loadUrl(withTvFlag(baseUrl))
            }
        }
    }

    private fun confirmExit() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastBackAt < EXIT_WINDOW_MS) {
            finish()
            return
        }
        lastBackAt = now
        Toast.makeText(this, R.string.press_back_again, Toast.LENGTH_SHORT).show()
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private fun backToPicker() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_NO_AUTO_CONNECT, true),
        )
        finish()
    }

    /** The TV shows the party screen only ("Jouer"), in TV mode. */
    private fun withTvFlag(url: String): String =
        Uri.parse(url).buildUpon()
            .path("/party")
            .appendQueryParameter("tv", "1")
            .build()
            .toString()

    private fun appVersion(): String =
        runCatching { packageManager.getPackageInfo(packageName, 0).versionName }.getOrNull() ?: "0"

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    }

    /** Keeps navigation on the Nightingale server; a lost server sends back to the picker. */
    private inner class StayOnServer : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val target = request.url
            val home = Uri.parse(baseUrl)
            return target.host != home.host || target.port != home.port
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (request.isForMainFrame) {
                Toast.makeText(
                    this@WebActivity,
                    getString(R.string.picker_unreachable, intent.getStringExtra(EXTRA_LABEL) ?: baseUrl),
                    Toast.LENGTH_LONG,
                ).show()
                backToPicker()
            }
        }
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_LABEL = "label"

        private const val EXIT_WINDOW_MS = 2_000L

        /**
         * Lets the page use Back like the Escape key: it pauses a song (the
         * pause menu has "Quit") and closes dialogs. Elsewhere the app goes
         * back through its own pages; at home a second press leaves.
         */
        private val PAGE_BACK_SCRIPT = """
            (function () {
              var path = location.pathname.replace(/\/+$/, '') || '/';
              var dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
              if (path.indexOf('/playback') === 0 || dialog) {
                var target = document.activeElement || document.body;
                var init = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true };
                target.dispatchEvent(new KeyboardEvent('keydown', init));
                target.dispatchEvent(new KeyboardEvent('keyup', init));
                return 'handled';
              }
              return path === '/' || path === '/party' ? 'home' : 'page';
            })();
        """.trimIndent()
    }
}
