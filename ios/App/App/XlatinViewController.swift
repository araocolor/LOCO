import UIKit
import Capacitor

class XlatinViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.isUserInteractionEnabled = true
        webView?.isUserInteractionEnabled = true
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        webView?.isUserInteractionEnabled = true
        if let webView {
            view.bringSubviewToFront(webView)
        }
    }
}
