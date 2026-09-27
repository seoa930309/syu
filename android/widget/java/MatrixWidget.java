package com.seoa930309.dayflow;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/** 매트릭스: 네 칸 */
public class MatrixWidget extends BaseWidget {
    @Override String title() { return "매트릭스"; }
    @Override String view() { return "matrix"; }
    @Override int layout() { return R.layout.dayflow_widget_matrix; }

    private static final int[][] CELLS = {
            {R.id.q1_t, R.id.q1_b}, {R.id.q2_t, R.id.q2_b}, {R.id.q3_t, R.id.q3_b}, {R.id.q4_t, R.id.q4_b}};

    @Override
    void fill(Context c, RemoteViews v, JSONObject root, JSONObject day, int muted) {
        v.removeAllViews(R.id.w_body);
        for (int[] cell : CELLS) v.removeAllViews(cell[1]);
        v.setTextViewText(R.id.w_foot, "");
        if (noData(c, v, R.id.w_body, root, muted)) return;
        String[][] q = {{"do", "일단 이것부터"}, {"schedule", "시간 빼두기"}, {"delegate", "얼른 처리하기"}, {"pass", "패스"}};
        JSONArray quads = root.optJSONArray("quads");
        if (quads != null && quads.length() == 4) {
            for (int i = 0; i < 4; i++) {
                JSONArray p = quads.optJSONArray(i);
                if (p != null) q[i] = new String[]{p.optString(0, q[i][0]), p.optString(1, q[i][1])};
            }
        }
        for (int i = 0; i < 4; i++) {
            List<JSONObject> list = todos(day, null, q[i][0]);
            v.setTextViewText(CELLS[i][0], q[i][1] + "  " + openCount(list));
            if (list.isEmpty()) v.addView(CELLS[i][1], row(c, WidgetData.muted("—", muted)));
            else addTodos(c, v, CELLS[i][1], list, 3, muted);
        }
        List<JSONObject> inbox = todos(day, null, "");
        int n = openCount(inbox);
        v.setTextViewText(R.id.w_foot, n > 0 ? "아직 분류 안 한 할 일 " + n + "개" : "");
    }
}
