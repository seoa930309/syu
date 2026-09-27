package com.seoa930309.dayflow;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayflowWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        remember(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        remember(intent);
    }

    /** 위젯에서 열었으면 어느 화면을 열지 적어 두고, 앱(웹)이 가져가요 */
    private void remember(Intent i) {
        if (i == null) return;
        String v = i.getStringExtra(WidgetData.EXTRA_VIEW);
        if (v == null) return;
        getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit().putString(WidgetData.VIEW_KEY, v).apply();
        i.removeExtra(WidgetData.EXTRA_VIEW);
    }
}
