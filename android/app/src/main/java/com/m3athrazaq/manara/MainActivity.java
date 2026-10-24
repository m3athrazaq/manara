package com.m3athrazaq.manara;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

/**
 * Full-screen mosque display. The whole screen is the offline page in
 * assets/index.html; this activity keeps it awake, full screen and
 * reachable with a TV remote, and gives it a small bridge for settings
 * storage, start-on-boot and exiting.
 */
public class MainActivity extends Activity {
    static final String PREFS = "manara";
    static final String KEY_AUTOSTART = "autoStart";
    private static final String KEY_SETTINGS = "settings";
    private static final String ASSET_ROOT = "file:///android_asset/";
    private static final String START_URL = ASSET_ROOT + "index.html";
    private static final int BG = Color.rgb(10, 21, 48);

    private final Handler main = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private long lastBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        createWebView();
        if (Build.VERSION.SDK_INT >= 33) registerBackCallback();
        hideSystemBars();
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // The screen never leaves its own page.
                return url == null || !url.startsWith(ASSET_ROOT);
            }

            @TargetApi(24)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return shouldOverrideUrlLoading(view, request.getUrl().toString());
            }

            @TargetApi(26)
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's renderer died (low memory on a small TV box): start it again.
                main.post(MainActivity.this::rebuildWebView);
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "ManaraAndroid");
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl(START_URL);
        web.requestFocus();
    }

    private void rebuildWebView() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        createWebView();
    }

    @TargetApi(33)
    private void registerBackCallback() {
        OnBackInvokedCallback callback = this::handleBack;
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
    }

    /** Android 12 and older; newer versions use the callback above. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        handleBack();
    }

    /** Back closes the settings or a preview first; on the main screen it needs two presses to exit. */
    private void handleBack() {
        if (web == null) {
            finish();
            return;
        }
        web.evaluateJavascript(
                "(function(){try{return window.manaraBack?!!window.manaraBack():false}catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) return;
                    long now = System.currentTimeMillis();
                    if (now - lastBack < 2500) {
                        finish();
                    } else {
                        lastBack = now;
                        Toast.makeText(this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_MENU || code == KeyEvent.KEYCODE_SETTINGS) {
            if (event.getAction() == KeyEvent.ACTION_UP && web != null) {
                web.evaluateJavascript("window.manaraMenu && window.manaraMenu()", null);
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
            if (web != null) web.requestFocus();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
        }
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private boolean canStartOnBoot() {
        return Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(this);
    }

    private void openOverlaySettings() {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())));
        } catch (RuntimeException first) {
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
            } catch (RuntimeException second) {
                Toast.makeText(this, R.string.no_overlay_settings, Toast.LENGTH_LONG).show();
            }
        }
    }

    /** Methods the page can call as window.ManaraAndroid.*; they run off the UI thread. */
    private final class Bridge {
        @JavascriptInterface
        public String getSettings() {
            return prefs().getString(KEY_SETTINGS, "");
        }

        @JavascriptInterface
        public void saveSettings(String json) {
            if (json != null && json.length() < 200_000) {
                prefs().edit().putString(KEY_SETTINGS, json).apply();
            }
        }

        @JavascriptInterface
        public boolean getAutoStart() {
            return prefs().getBoolean(KEY_AUTOSTART, true);
        }

        @JavascriptInterface
        public void setAutoStart(boolean on) {
            prefs().edit().putBoolean(KEY_AUTOSTART, on).apply();
        }

        @JavascriptInterface
        public boolean autoStartReady() {
            return canStartOnBoot();
        }

        @JavascriptInterface
        public void openAutoStartSettings() {
            main.post(MainActivity.this::openOverlaySettings);
        }

        @JavascriptInterface
        public String appVersion() {
            return BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")";
        }

        @JavascriptInterface
        public void exitApp() {
            main.post(MainActivity.this::finish);
        }
    }
}
