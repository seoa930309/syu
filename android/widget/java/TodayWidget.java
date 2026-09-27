package com.seoa930309.dayflow;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/** 오늘 할 일: 오늘 일정 + 할 일 */
public class TodayWidget extends BaseWidget {
    @Override String title() { return "오늘 할 일"; }
    @Override String view() { return "calendar"; }

    @Override
    void fill(Context c, RemoteViews v, JSONObject root, JSONObject day, int muted) {
        v.removeAllViews(R.id.w_body);
        if (noData(c, v, R.id.w_body, root, muted)) return;
        List<JSONObject> list = todos(day, null, null);
        int done = list.size() - openCount(list);
        v.setTextViewText(R.id.w_date, WidgetData.todayLabel() + (list.isEmpty() ? "" : " · 완료 " + done + "/" + list.size()));
        JSONArray ev = day.optJSONArray("ev");
        int rows = 0;
        if (ev != null) {
            for (int i = 0; i < ev.length() && i < 3; i++) {
                JSONObject e = ev.optJSONObject(i);
                if (e != null) { v.addView(R.id.w_body, row(c, WidgetData.eventLine(e, muted))); rows++; }
            }
            if (ev.length() > 3) { v.addView(R.id.w_body, row(c, WidgetData.muted("일정 +" + (ev.length() - 3) + "개 더", muted))); rows++; }
        }
        if (list.isEmpty()) {
            v.addView(R.id.w_body, row(c, WidgetData.muted(rows > 0 ? "할 일은 없어요" : "오늘은 일정도 할 일도 없어요", muted)));
            return;
        }
        addTodos(c, v, R.id.w_body, list, Math.max(4, 12 - rows), muted);
    }
}
