package com.medflow.clinic;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.content.Context;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Add Java object bridge for native printing on Android WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new AndroidPrintBridge(this), "AndroidPrintBridge");
        }
    }

    public class AndroidPrintBridge {
        Context context;

        AndroidPrintBridge(Context c) {
            context = c;
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        WebView webView = bridge.getWebView();
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Medflow_Medical_Certificate");
                        String jobName = "Medflow Document";
                        if (printManager != null) {
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    }
                }
            });
        }
    }
}
