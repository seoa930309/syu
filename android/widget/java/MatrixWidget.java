package com.seoa930309.dayflow;

import android.app.PendingIntent;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.List;

/** 매트릭스: 네 칸, 칸마다 스크롤 */
public class MatrixWidget extends BaseWidget {
    @Override String title() { return "매트릭스"; }
    @Override String view() { return "matrix"; }
    @Override int layout() { return R.layout.dayflow_widget_matrix; }
    @Override int[] listIds() { return new int[]{R.id.q1_list, R.id.q2_list, R.id.q3_list, R.id.q4_list}; }

    private static final int[][] CELLS = {
            {R.id.q1_t, R.id.q1_list, R.id.q1_bg}, {R.id.q2_t, R.id.q2_list, R.id.q2_bg},
            {R.id.q3_t, R.id.q3_list, R.id.q3_bg}, {R.id.q4_t, R.id.q4_list, R.id.q4_bg}};

    @Override
    void lists(Context c, RemoteViews v, int id, JSONObject root, PendingIntent toggle) {
        JSONObject day = WidgetData.today(root);
        String[][] q = WidgetData.pairs(root, "quads", WidgetData.QUADS);
        @SuppressWarnings("deprecation")
        int muted = c.getResources().getColor(R.color.w_muted);
        @SuppressWarnings("deprecation")
        int cellDefault = c.getResources().getColor(R.color.w_cell);
        for (int i = 0; i < 4; i++) {
            // 색 설정 → 위젯 사분면에서 정한 색 (없으면 기본 회색)
            int bg = WidgetData.parseColor(q[i][2], 0);
            v.setInt(CELLS[i][2], "setColorFilter", bg != 0 ? bg : cellDefault);
            v.setTextColor(CELLS[i][0], bg != 0 ? WidgetData.soft(WidgetData.textOn(bg)) : muted);
            List<JSONObject> list = WidgetData.todos(day, null, q[i][0]);
            v.setTextViewText(CELLS[i][0], q[i][1] + "  " + (root == null ? "" : WidgetData.openCount(list)));
            bindList(c, v, CELLS[i][1], id, "quad", q[i][0], toggle);
        }
        int n = root == null ? 0 : WidgetData.openCount(WidgetData.todos(day, null, ""));
        v.setTextViewText(R.id.w_foot, root == null ? "dayflow 앱을 한 번 열면 표시돼요" : n > 0 ? "아직 분류 안 한 할 일 " + n + "개" : "");
    }
}
