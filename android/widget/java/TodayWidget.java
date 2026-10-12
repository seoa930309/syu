package com.seoa930309.dayflow;

import android.app.PendingIntent;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.List;

/** 오늘 할 일: 오늘 일정 + 할 일 (스크롤) */
public class TodayWidget extends BaseWidget {
    @Override String title() { return "오늘 할 일"; }
    @Override String view() { return "calendar"; }
    @Override int[] listIds() { return new int[]{R.id.w_list}; }

    @Override
    String dateExtra(JSONObject root, JSONObject day) {
        if (root == null) return "";
        List<JSONObject> list = WidgetData.todos(day, null, null);
        return list.isEmpty() ? "" : " · 완료 " + (list.size() - WidgetData.openCount(list)) + "/" + list.size();
    }

    @Override
    void lists(Context c, RemoteViews v, int id, JSONObject root, PendingIntent toggle) {
        bindList(c, v, R.id.w_list, id, "today", null, toggle);
    }
}
