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
            {R.id.q1_t, R.id.q1_b, R.id.q1_bg}, {R.id.q2_t, R.id.q2_b, R.id.q2_bg},
            {R.id.q3_t, R.id.q3_b, R.id.q3_bg}, {R.id.q4_t, R.id.q4_b, R.id.q4_bg}};

    @Override
    void fill(Context c, RemoteViews v, JSONObject root, JSONObject day, int muted) {
        v.removeAllViews(R.id.w_body);
        for (int[] cell : CELLS) v.removeAllViews(cell[1]);
        v.setTextViewText(R.id.w_foot, "");
        if (noData(c, v, R.id.w_body, root, muted)) return;
        String[][] q = {{"do", "일단 이것부터", ""}, {"schedule", "시간 빼두기", ""}, {"delegate", "얼른 처리하기", ""}, {"pass", "패스", ""}};
        JSONArray quads = root.optJSONArray("quads");
        if (quads != null && quads.length() == 4) {
            for (int i = 0; i < 4; i++) {
                JSONArray p = quads.optJSONArray(i);
                if (p != null) q[i] = new String[]{p.optString(0, q[i][0]), p.optString(1, q[i][1]), p.optString(2, "")};
            }
        }
        @SuppressWarnings("deprecation")
        int cellDefault = c.getResources().getColor(R.color.w_cell);
        for (int i = 0; i < 4; i++) {
            // 앱의 색 설정 → 매트릭스 사분면에서 정한 색 (없으면 기본 회색)
            int bg = WidgetData.parseColor(q[i][2], 0);
            boolean custom = bg != 0;
            v.setInt(CELLS[i][2], "setColorFilter", custom ? bg : cellDefault);
            int fg = custom ? WidgetData.textOn(bg) : 0;
            int cm = custom ? WidgetData.soft(fg) : muted;
            v.setTextColor(CELLS[i][0], cm);
            List<JSONObject> list = todos(day, null, q[i][0]);
            v.setTextViewText(CELLS[i][0], q[i][1] + "  " + openCount(list));
            if (list.isEmpty()) {
                RemoteViews dash = row(c, WidgetData.muted("—", cm));
                v.addView(CELLS[i][1], dash);
            } else addTodos(c, v, CELLS[i][1], list, 3, cm, fg);
        }
        List<JSONObject> inbox = todos(day, null, "");
        int n = openCount(inbox);
        v.setTextViewText(R.id.w_foot, n > 0 ? "아직 분류 안 한 할 일 " + n + "개" : "");
    }
}
