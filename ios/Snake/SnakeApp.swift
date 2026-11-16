//
//  SnakeApp.swift
//  Snake
//
//  The whole iPhone app: a full-screen web view that runs the game from
//  game.html (packed by ios/build_web.py), plus short vibrations when the
//  game asks for them.
//

import SwiftUI
import UIKit
import WebKit

/// The page background color from css/style.css (#f3f7ee), so there's no white flash
private let pageBackground = UIColor(red: 243 / 255, green: 247 / 255, blue: 238 / 255, alpha: 1)

@main
struct SnakeApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()   // the page itself keeps clear of the notch and home bar
                .background(Color(uiColor: pageBackground))
        }
    }
}

/// Shows the game in a full-screen web view
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // The game calls window.webkit.messageHandlers.haptic.postMessage("eat" / "shrink" / "crash")
        config.userContentController.add(context.coordinator, name: "haptic")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = pageBackground
        webView.scrollView.backgroundColor = pageBackground
        webView.scrollView.bounces = false                       // no rubber-band bounce
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false

        if let page = Bundle.main.url(forResource: "game", withExtension: "html") {
            // Allow the page to load supabase.js from the same folder in the app
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    /// Turns messages from the game into vibrations
    final class Coordinator: NSObject, WKScriptMessageHandler {
        private let light = UIImpactFeedbackGenerator(style: .light)
        private let medium = UIImpactFeedbackGenerator(style: .medium)
        private let notification = UINotificationFeedbackGenerator()

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            switch message.body as? String {
            case "eat":
                light.impactOccurred()                      // ate food
            case "shrink":
                medium.impactOccurred()                     // ate a cactus or pill
            case "crash":
                notification.notificationOccurred(.error)   // game over
            default:
                break
            }
        }
    }
}
