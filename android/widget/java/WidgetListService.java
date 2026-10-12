package com.seoa930309.dayflow;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 위젯 안의 스크롤 목록: 할 일을 "+N개 더" 없이 전부 보여줘요 */
public class WidgetListService extends RemoteViewsService {
    static final String EXTRA_KIND = "dayflow_kind";   // today · slots · quad
    static final String EXTRA_QUAD = "dayflow_quad";   // 매트릭스 칸 (do · schedule · delegate · pass)

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent);
    }

    /** 목록 한 줄 */
    static final class Row {
        final int type;          // 0 할 일 · 1 머리글 · 2 일정 · 3 안내
        final CharSequence text;
        final String id;
        Row(int type, CharSequence text, String id) { this.type = type; this.text = text; this.id = id; }
    }

    static final class Factory implements RemoteViewsFactory {
        private final Context c;
        private final String kind, quad;
        private final List<Row> rows = new ArrayList<>();
        private int fg = 0;

        Factory(Context c, Intent i) {
            this.c = c;
            this.kind = i.getStringExtra(EXTRA_KIND) == null ? "today" : i.getStringExtra(EXTRA_KIND);
            this.quad = i.getStringExtra(EXTRA_QUAD);
        }

        @Override public void onCreate() { }
        @Override public void onDestroy() { rows.clear(); }

        @Override
        public void onDataSetChanged() {
            rows.clear();
            fg = 0;
            JSONObject root = WidgetData.root(c);
            if (root == null) { rows.add(new Row(3, "dayflow 앱을 한 번 열면 여기에 표시돼요", null)); return; }
            JSONObject day = WidgetData.today(root);
            @SuppressWarnings("deprecation")
            int muted = c.getResources().getColor(R.color.w_muted);
            if ("quad".equals(kind)) {
                String[][] q = WidgetData.pairs(root, "quads", WidgetData.QUADS);
                String hex = "";
                for (String[] x : q) if (x[0].equals(quad)) hex = x[2];
                int bg = WidgetData.parseColor(hex, 0);
                if (bg != 0) { fg = WidgetData.textOn(bg); muted = WidgetData.soft(fg); }
                List<JSONObject> list = WidgetData.todos(day, null, quad);
                if (list.isEmpty()) rows.add(new Row(3, WidgetData.muted("—", muted), null));
                for (JSONObject t : list) rows.add(todo(t, muted));
                return;
            }
            if ("slots".equals(kind)) {
                for (String[] s : WidgetData.pairs(root, "slots", WidgetData.SLOTS)) {
                    List<JSONObject> list = WidgetData.todos(day, s[0], null);
                    rows.add(new Row(1, s[1] + "  " + WidgetData.openCount(list), null));
                    if (list.isEmpty()) rows.add(new Row(3, WidgetData.muted("—", muted), null));
                    for (JSONObject t : list) rows.add(todo(t, muted));
                }
                List<JSONObject> rest = WidgetData.todos(day, "", null);
                if (!rest.isEmpty()) {
                    rows.add(new Row(1, "시간 미정  " + WidgetData.openCount(rest), null));
                    for (JSONObject t : rest) rows.add(todo(t, muted));
                }
                return;
            }
            // 오늘 할 일: 일정 → 할 일
            JSONArray ev = day == null ? null : day.optJSONArray("ev");
            if (ev != null) for (int i = 0; i < ev.length(); i++) {
                JSONObject e = ev.optJSONObject(i);
                if (e != null) rows.add(new Row(2, WidgetData.eventLine(e, muted), null));
            }
            List<JSONObject> list = WidgetData.todos(day, null, null);
            if (list.isEmpty()) rows.add(new Row(3, WidgetData.muted(rows.isEmpty() ? "오늘은 일정도 할 일도 없어요" : "할 일은 없어요", muted), null));
            for (JSONObject t : list) rows.add(todo(t, muted));
        }

        private Row todo(JSONObject t, int muted) {
            return new Row(0, WidgetData.todoLine(t, muted), t.optString("id", ""));
        }

        @Override public int getCount() { return rows.size(); }

        @Override
        public RemoteViews getViewAt(int pos) {
            if (pos < 0 || pos >= rows.size()) return null;
            Row r = rows.get(pos);
            RemoteViews v = new RemoteViews(c.getPackageName(), r.type == 1 ? R.layout.widget_head : R.layout.widget_row);
            v.setTextViewText(R.id.w_text, r.text);
            if (fg != 0 && r.type != 1) v.setTextColor(R.id.w_text, fg);
            if (r.type == 0 && r.id != null && r.id.length() > 0) {
                // 누르면 위젯의 체크 템플릿(ACTION_TOGGLE)에 이 할 일 id가 채워져요
                Intent fill = new Intent();
                fill.putExtra("id", r.id);
                v.setOnClickFillInIntent(R.id.w_text, fill);
            }
            return v;
        }

        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 2; }
        @Override public long getItemId(int pos) { return pos; }
        @Override public boolean hasStableIds() { return false; }
    }

    /** 목록 연결용 Intent (위젯 · 칸마다 달라야 해요) */
    static Intent intent(Context c, int widgetId, String kind, String quad) {
        Intent i = new Intent(c, WidgetListService.class);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        i.putExtra(EXTRA_KIND, kind);
        if (quad != null) i.putExtra(EXTRA_QUAD, quad);
        i.setData(android.net.Uri.parse(i.toUri(Intent.URI_INTENT_SCHEME)));
        return i;
    }
}
