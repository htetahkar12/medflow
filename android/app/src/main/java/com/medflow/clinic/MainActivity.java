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
            printPage("a4");
        }

        @JavascriptInterface
        public void printPage(final String printType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        WebView webView = bridge.getWebView();
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Medflow_Document");
                        String jobName = "Medflow Document";
                        if (printManager != null) {
                            PrintAttributes.Builder builder = new PrintAttributes.Builder();
                            
                            if ("thermal".equalsIgnoreCase(printType)) {
                                // 80mm roll, set height to large continuous size
                                PrintAttributes.MediaSize thermalRollSize = new PrintAttributes.MediaSize("roll_80mm", "Thermal Roll 80mm", 3150, 11000);
                                builder.setMediaSize(thermalRollSize);
                            } else if ("a5".equalsIgnoreCase(printType)) {
                                builder.setMediaSize(PrintAttributes.MediaSize.ISO_A5);
                            } else if ("idcard".equalsIgnoreCase(printType)) {
                                PrintAttributes.MediaSize idCardSize = new PrintAttributes.MediaSize("idcard", "ID Card Size", 3370, 2130);
                                builder.setMediaSize(idCardSize);
                            } else {
                                builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                            }
                            
                            printManager.print(jobName, printAdapter, builder.build());
                        }
                    }
                }
            });
        }
    }
}
