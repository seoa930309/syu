package com.seoa930309.dayflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** 세 위젯이 함께 쓰는 틀: 제목 · 날짜 · 스크롤 목록 · 누르면 체크 / 앱 열기 */
public abstract class BaseWidget extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "com.seoa930309.dayflow.TOGGLE";

    abstract String title();
    /** 누르면 열 앱 화면: calendar · flow · matrix */
    abstract String view();
    int layout() { return R.layout.dayflow_widget; }
    /** 날짜 옆에 붙일 말 (완료 개수 등) */
    String dateExtra(JSONObject root, JSONObject day) { return ""; }
    /** 목록 연결 */
    abstract void lists(Context c, RemoteViews v, int widgetId, JSONObject root, PendingIntent toggle);
    abstract int[] listIds();

    @Override
    public void onReceive(Context c, Intent i) {
        if (ACTION_TOGGLE.equals(i.getAction())) {
            String id = i.getStringExtra("id");
            if (id != null && id.length() > 0) {
                WidgetData.toggle(c, id);
                WidgetData.updateAll(c);
            }
            return;
        }
        super.onReceive(c, i);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject root = WidgetData.root(c);
        JSONObject day = WidgetData.today(root);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), layout());
            v.setTextViewText(R.id.w_title, title());
            String extra = "";
            try { extra = dateExtra(root, day); } catch (Exception ignored) { }
            v.setTextViewText(R.id.w_date, WidgetData.todayLabel() + extra);

            // 머리(제목 · 날짜)를 누르면 앱 열기
            Intent open = new Intent(c, MainActivity.class);
            open.setAction("com.seoa930309.dayflow.OPEN_" + view());
            open.putExtra(WidgetData.EXTRA_VIEW, view());
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, view().hashCode(), open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_head, pi);

            // 목록의 할 일을 누르면 체크 (각 줄이 id를 채워 넣어요 → 바뀔 수 있어야 해서 MUTABLE)
            Intent t = new Intent(c, getClass());
            t.setAction(ACTION_TOGGLE);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent toggle = PendingIntent.getBroadcast(c, (view() + "-toggle-" + id).hashCode(), t, flags);

            lists(c, v, id, root, toggle);
            m.updateAppWidget(id, v);
            m.notifyAppWidgetViewDataChanged(id, listIds());
        }
    }

    /** 스크롤 목록 하나 연결 */
    @SuppressWarnings("deprecation")
    static void bindList(Context c, RemoteViews v, int listId, int widgetId, String kind, String quad, PendingIntent toggle) {
        v.setRemoteAdapter(listId, WidgetListService.intent(c, widgetId, kind, quad));
        v.setPendingIntentTemplate(listId, toggle);
    }
}
