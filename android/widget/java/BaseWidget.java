package com.seoa930309.dayflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 세 위젯이 함께 쓰는 틀: 제목 · 날짜 · 누르면 앱 열기 */
public abstract class BaseWidget extends AppWidgetProvider {
    abstract String title();
    /** 누르면 열 앱 화면: calendar · flow · matrix */
    abstract String view();
    int layout() { return R.layout.dayflow_widget; }
    abstract void fill(Context c, RemoteViews v, JSONObject root, JSONObject day, int muted);

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject root = WidgetData.root(c);
        JSONObject day = WidgetData.today(root);
        @SuppressWarnings("deprecation")
        int muted = c.getResources().getColor(R.color.w_muted);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), layout());
            v.setTextViewText(R.id.w_title, title());
            v.setTextViewText(R.id.w_date, WidgetData.todayLabel());
            try {
                fill(c, v, root, day, muted);
            } catch (Exception e) {
                v.removeAllViews(R.id.w_body);
                v.addView(R.id.w_body, row(c, "앱을 열어 다시 불러와 주세요"));
            }
            Intent open = new Intent(c, MainActivity.class);
            open.setAction("com.seoa930309.dayflow.OPEN_" + view());
            open.putExtra(WidgetData.EXTRA_VIEW, view());
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, view().hashCode(), open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_root, pi);
            m.updateAppWidget(id, v);
        }
    }

    static RemoteViews row(Context c, CharSequence text) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_row);
        r.setTextViewText(R.id.w_text, text);
        return r;
    }

    static RemoteViews head(Context c, CharSequence text) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_head);
        r.setTextViewText(R.id.w_text, text);
        return r;
    }

    /** 안 한 것 먼저, 한 것은 뒤로 */
    static List<JSONObject> todos(JSONObject day, String slot, String quad) {
        List<JSONObject> open = new ArrayList<>(), done = new ArrayList<>();
        JSONArray a = day == null ? null : day.optJSONArray("td");
        if (a == null) return open;
        for (int i = 0; i < a.length(); i++) {
            JSONObject t = a.optJSONObject(i);
            if (t == null) continue;
            if (slot != null && !slot.equals(t.optString("sl", ""))) continue;
            if (quad != null && !quad.equals(t.optString("q", ""))) continue;
            (t.optBoolean("d") ? done : open).add(t);
        }
        open.addAll(done);
        return open;
    }

    static int openCount(List<JSONObject> list) {
        int n = 0;
        for (JSONObject t : list) if (!t.optBoolean("d")) n++;
        return n;
    }

    /** 목록을 max개까지 넣고, 넘치면 "+N개 더" */
    static void addTodos(Context c, RemoteViews v, int body, List<JSONObject> list, int max, int muted) {
        int shown = 0;
        for (JSONObject t : list) {
            if (shown >= max) break;
            v.addView(body, row(c, WidgetData.todoLine(t, muted)));
            shown++;
        }
        if (list.size() > shown) v.addView(body, row(c, WidgetData.muted("+" + (list.size() - shown) + "개 더", muted)));
    }

    static boolean noData(Context c, RemoteViews v, int body, JSONObject root, int muted) {
        if (root != null) return false;
        v.addView(body, row(c, WidgetData.muted("dayflow 앱을 한 번 열면 여기에 표시돼요", muted)));
        return true;
    }
}
