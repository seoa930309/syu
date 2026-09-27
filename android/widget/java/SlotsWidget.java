package com.seoa930309.dayflow;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/** 오전 · 오후 · 밤: 플로우 탭의 시간대별 할 일 */
public class SlotsWidget extends BaseWidget {
    @Override String title() { return "오전 · 오후 · 밤"; }
    @Override String view() { return "flow"; }

    @Override
    void fill(Context c, RemoteViews v, JSONObject root, JSONObject day, int muted) {
        v.removeAllViews(R.id.w_body);
        if (noData(c, v, R.id.w_body, root, muted)) return;
        JSONArray slots = root.optJSONArray("slots");
        String[][] names = {{"morning", "오전"}, {"afternoon", "오후"}, {"night", "밤"}};
        if (slots != null && slots.length() == 3) {
            for (int i = 0; i < 3; i++) {
                JSONArray p = slots.optJSONArray(i);
                if (p != null) names[i] = new String[]{p.optString(0, names[i][0]), p.optString(1, names[i][1])};
            }
        }
        int total = 0;
        for (String[] s : names) {
            List<JSONObject> list = todos(day, s[0], null);
            total += list.size();
            v.addView(R.id.w_body, head(c, s[1] + "  " + openCount(list)));
            if (list.isEmpty()) v.addView(R.id.w_body, row(c, WidgetData.muted("—", muted)));
            else addTodos(c, v, R.id.w_body, list, 3, muted);
        }
        List<JSONObject> rest = todos(day, "", null);
        if (!rest.isEmpty()) {
            v.addView(R.id.w_body, head(c, "시간 미정  " + openCount(rest)));
            addTodos(c, v, R.id.w_body, rest, 2, muted);
        }
        if (total == 0 && rest.isEmpty()) v.addView(R.id.w_body, row(c, WidgetData.muted("오늘은 할 일이 없어요", muted)));
    }
}
