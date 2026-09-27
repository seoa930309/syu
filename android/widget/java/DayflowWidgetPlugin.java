package com.seoa930309.dayflow;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Iterator;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 웹 앱 ↔ 홈 화면 위젯 연결 */
@CapacitorPlugin(name = "DayflowWidget")
public class DayflowWidgetPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json 없음"); return; }
        Context c = getContext();
        json = WidgetData.keepPending(c, json);
        c.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit().putString(WidgetData.KEY, json).apply();
        WidgetData.updateAll(c);
        call.resolve();
    }

    /** 위젯에서 체크한 것들을 앱으로: {items: [{id, d}]} */
    @PluginMethod
    public void takePending(PluginCall call) {
        JSONObject pend = WidgetData.takePending(getContext());
        JSArray items = new JSArray();
        Iterator<String> it = pend.keys();
        while (it.hasNext()) {
            String id = it.next();
            JSObject o = new JSObject();
            o.put("id", id);
            o.put("d", pend.optBoolean(id));
            items.put(o);
        }
        JSObject r = new JSObject();
        r.put("items", items);
        call.resolve(r);
    }

    /** 위젯을 눌러 앱을 열었을 때 열어야 할 화면 (한 번 읽으면 지워요) */
    @PluginMethod
    public void takeView(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE);
        String v = p.getString(WidgetData.VIEW_KEY, null);
        p.edit().remove(WidgetData.VIEW_KEY).apply();
        JSObject r = new JSObject();
        if (v != null) r.put("view", v);
        call.resolve(r);
    }
}
