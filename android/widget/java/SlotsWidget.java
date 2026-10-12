package com.seoa930309.dayflow;

import android.app.PendingIntent;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** 오전 · 오후 · 밤: 플로우 탭의 시간대별 할 일 (스크롤) */
public class SlotsWidget extends BaseWidget {
    @Override String title() { return "오전 · 오후 · 밤"; }
    @Override String view() { return "flow"; }
    @Override int[] listIds() { return new int[]{R.id.w_list}; }

    @Override
    void lists(Context c, RemoteViews v, int id, JSONObject root, PendingIntent toggle) {
        bindList(c, v, R.id.w_list, id, "slots", null, toggle);
    }
}
