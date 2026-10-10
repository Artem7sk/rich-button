package com.paidflow.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONTokener;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

// A generated document is written to the exact EXTRA_OUTPUT URI used by cameras.
// These tests run real Tesseract and the real WebView, not mock OCR callbacks.
@RunWith(AndroidJUnit4.class)
public class NativeScanTest {
    @Before public void clearTestData(){Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();for(String name:new String[]{"paidflow-v1.json","paidflow-v1.json.bak","paidflow-v1.json.new"})new File(context.getFilesDir(),name).delete();}
    private static Object field(Object object,String name){try{Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);return f.get(object);}catch(Exception e){throw new AssertionError(e);}}
    private static void field(Object object,String name,Object value){try{Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);f.set(object,value);}catch(Exception e){throw new AssertionError(e);}}
    private static String js(ActivityScenario<MainActivity> scenario,String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->((WebView)field(a,"web")).evaluateJavascript(script,value->{result.set(value);latch.countDown();}));assertTrue("WebView callback timed out",latch.await(10,TimeUnit.SECONDS));return result.get();}
    private static void awaitJs(ActivityScenario<MainActivity> scenario,String condition)throws Exception{long deadline=System.currentTimeMillis()+90000;String result="";do{result=js(scenario,condition);if("true".equals(result))return;Thread.sleep(300);}while(System.currentTimeMillis()<deadline);fail("Condition failed: "+condition+"; status: "+js(scenario,"document.querySelector('.scan-status:not([hidden])')?.textContent"));}
    private static void ready(ActivityScenario<MainActivity> scenario)throws Exception{awaitJs(scenario,"typeof store!=='undefined'&&!!store");}
    private static void cameraOutput(ActivityScenario<MainActivity> scenario,String target,String[] lines)throws Exception{
        AtomicReference<File> output=new AtomicReference<>();AtomicReference<Uri> uri=new AtomicReference<>();
        scenario.onActivity(a->{File dir=new File(a.getCacheDir(),"scan");dir.mkdirs();File file=new File(dir,"capture-"+System.currentTimeMillis()+".jpg");output.set(file);uri.set(Uri.parse("content://com.paidflow.app.fileprovider/scan/"+file.getName()));});
        Bitmap bitmap=Bitmap.createBitmap(2000,1200,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(Color.BLACK);paint.setTextSize(48);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));int y=90;for(String line:lines){canvas.drawText(line,60,y,paint);y+=90;}
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();try(OutputStream out=context.getContentResolver().openOutputStream(uri.get(),"w")){assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,98,out));}bitmap.recycle();
        Object draft=new JSONTokener(js(scenario,"captureScanDraft('"+target+"')")).nextValue();
        scenario.onActivity(a->{field(a,"captureFile",output.get());field(a,"captureUri",uri.get());field(a,"scanTarget",target);field(a,"scanDraft",String.valueOf(draft));});
    }
    @Test public void clientPhotoFillsFieldsAfterActivityRecreation()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);js(scenario,"store.saveSettings({...store.data.settings,business:'Test',language:'ru'});clientForm();document.querySelector('#notes').value='Draft preserved'");
            cameraOutput(scenario,"client",new String[]{"Организация: ТОО Альфа","БИН: 123456789012","Адрес: Алматы, Абая 10","ИИК: KZ86125KZT5004100100","БИК: HSBKKZKX","КБе: 17"});
            scenario.recreate();ready(scenario);scenario.onActivity(a->a.onActivityResult(103,Activity.RESULT_OK,null));
            awaitJs(scenario,"document.querySelector('#binIin')?.value==='123456789012'");
            assertEquals("\"Draft preserved\"",js(scenario,"document.querySelector('#notes').value"));
            assertEquals("\"HSBKKZKX\"",js(scenario,"document.querySelector('#bic').value"));
            assertEquals("\"KZ86125KZT5004100100\"",js(scenario,"document.querySelector('#account').value"));
        }
    }
    @Test public void invoicePhotoAddsItemsAndOffersNewClient()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);js(scenario,"store.saveSettings({...store.data.settings,business:'Test',language:'ru',currency:'KZT'});invoiceForm()");
            cameraOutput(scenario,"invoice",new String[]{"Покупатель: ТОО Альфа","БИН: 123456789012","1 Бумага 2 шт 1200,00 2400,00","Итого: 2400,00 KZT"});
            scenario.onActivity(a->a.onActivityResult(103,Activity.RESULT_OK,null));
            awaitJs(scenario,"document.querySelector('.line-price')?.value==='1200.00'&&!document.querySelector('#scan-new-client').hidden");
            assertEquals("1",js(scenario,"document.querySelectorAll('.line-fields').length"));
            assertEquals("\"123456789012\"",js(scenario,"document.querySelector('#ic-binIin').value"));
            assertEquals("0",js(scenario,"store.data.clients.length"));
            js(scenario,"saveInlineClient()");assertEquals("1",js(scenario,"store.data.clients.length"));
        }
    }
}
