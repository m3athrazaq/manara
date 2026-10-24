package com.m3athrazaq.manara;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Opens the screen after the TV box starts, and again after the app is updated. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        boolean start = Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (!start) return;
        boolean enabled = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)
                .getBoolean(MainActivity.KEY_AUTOSTART, true);
        if (!enabled) return;
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try {
            context.startActivity(open);
        } catch (RuntimeException ignored) {
            // Android 10+ blocks this without the "display over other apps" permission;
            // the settings page in the app explains how to grant it.
        }
    }
}
