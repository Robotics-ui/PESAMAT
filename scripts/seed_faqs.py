#!/usr/bin/env python3
"""
Seed comprehensive FAQs + user instructions into the PesaMatrix database via API.
Run: python3 scripts/seed_faqs.py
"""

import json
import subprocess
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8080"

# ── Auth ──────────────────────────────────────────────────────────────────────

def login():
    body = json.dumps({"email": "admin@pesamatrix.com", "password": "Admin@2024!"}).encode()
    req = urllib.request.Request(f"{BASE}/api/auth/login", data=body,
                                  headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["token"]

def post_faq(token, faq):
    body = json.dumps(faq).encode()
    req = urllib.request.Request(f"{BASE}/api/faqs", data=body,
                                  headers={"Content-Type": "application/json",
                                           "Authorization": f"Bearer {token}"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# ── FAQ Data ──────────────────────────────────────────────────────────────────

FAQS = [

  # ── Getting Started ────────────────────────────────────────────────────────
  {
    "category": "Getting Started",
    "sortOrder": 1,
    "status": "published",
    "question": "What is PesaMatrix?",
    "answer": (
      "PesaMatrix is a cloud-to-cloud copy trading platform that lets you automatically copy trades "
      "from professional master traders directly into your own MT5 account — without giving anyone "
      "access to your money.\n\n"
      "Here is how it works in simple terms:\n"
      "• A master trader executes trades on their MetaTrader 5 account.\n"
      "• PesaMatrix detects those trades instantly via MetaApi's cloud technology.\n"
      "• The same trades are mirrored to your MT5 account in real time.\n"
      "• Your funds stay in your own account at your own broker at all times.\n\n"
      "PesaMatrix charges a small daily subscription fee (paid via M-Pesa) for the copying service. "
      "It never holds, manages, or touches your trading capital."
    ),
  },
  {
    "category": "Getting Started",
    "sortOrder": 2,
    "status": "published",
    "question": "Who is PesaMatrix for?",
    "answer": (
      "PesaMatrix is designed for two types of users:\n\n"
      "1. Subscribers (Followers)\n"
      "   People who want to copy profitable traders without needing to trade themselves. "
      "You connect your MT5 account, pay a small daily fee, and trades are automatically "
      "mirrored into your account.\n\n"
      "2. Master Traders (Signal Providers)\n"
      "   Experienced traders who want to share their strategies. Your trades are copied to "
      "subscriber accounts. The platform gives you visibility and a track record.\n\n"
      "You need a MetaTrader 5 (MT5) account at any supported broker to use the platform."
    ),
  },
  {
    "category": "Getting Started",
    "sortOrder": 3,
    "status": "published",
    "question": "How do I get started as a subscriber? (Step-by-step)",
    "answer": (
      "Follow these steps to start copying trades:\n\n"
      "Step 1 — Register\n"
      "  Go to the Register page, fill in your name, email, phone number, and password. "
      "Use the phone number linked to your M-Pesa line.\n\n"
      "Step 2 — Verify your phone (OTP)\n"
      "  You will receive a 6-digit OTP via SMS. Enter it on the verification screen. "
      "This also activates your free 2-day trial.\n\n"
      "Step 3 — Add a Slave Account\n"
      "  Go to Slave Accounts → Add Slave Account. Enter your MT5 account number, "
      "investor password, and the broker server name. Submit and wait 1–3 minutes for "
      "the account to reach 'Connected' status.\n\n"
      "Step 4 — Subscribe\n"
      "  Go to the Subscribe page. Enter how many trading days you want to pay for, "
      "enter your M-Pesa number, and tap Pay. Approve the STK Push prompt on your phone.\n\n"
      "Step 5 — Bindings are created automatically\n"
      "  Once payment is confirmed your account is bound to the active copy strategy. "
      "Trades start copying immediately."
    ),
  },
  {
    "category": "Getting Started",
    "sortOrder": 4,
    "status": "published",
    "question": "How does the 2-day free trial work?",
    "answer": (
      "Every new user gets a one-time 2-day free trial:\n\n"
      "• The trial is activated automatically when you verify your phone number via OTP during registration.\n"
      "• It gives you full copy trading access for 2 trading days (Monday–Friday).\n"
      "• You do not need to enter payment details or M-Pesa to use the trial.\n"
      "• The trial cannot be transferred to another account or restarted.\n"
      "• After the trial expires, your bindings are suspended until you make a subscription payment.\n\n"
      "Tip: Add your slave account before or immediately after registration so copy trading "
      "starts as soon as the trial activates."
    ),
  },
  {
    "category": "Getting Started",
    "sortOrder": 5,
    "status": "published",
    "question": "Do I need to transfer my money to PesaMatrix?",
    "answer": (
      "No — never. Your trading capital stays in your own MT5 account at your own broker.\n\n"
      "PesaMatrix only reads trade signals from the master account and replicates them to "
      "your account using MetaApi's cloud-to-cloud connection. It uses your investor "
      "(read-only) password, which cannot withdraw funds, place manual trades, or change "
      "your account settings.\n\n"
      "The only payment you make to PesaMatrix is the daily subscription fee via M-Pesa, "
      "which covers the cost of the copy trading service itself."
    ),
  },
  {
    "category": "Getting Started",
    "sortOrder": 6,
    "status": "published",
    "question": "What do I need before I can start using PesaMatrix?",
    "answer": (
      "Before signing up, make sure you have the following:\n\n"
      "✓ An MT5 trading account at any broker (e.g. Exness, XM, FBS, Pepperstone)\n"
      "✓ Your MT5 account number (login ID)\n"
      "✓ Your MT5 investor password (not your main trading password)\n"
      "✓ Your MT5 broker server name (visible in your MT5 platform under File → Login)\n"
      "✓ A Safaricom M-Pesa line for subscription payments\n"
      "✓ A working email address for account notifications\n\n"
      "You do NOT need any trading experience — the master trader handles all trade decisions."
    ),
  },

  # ── Subscriptions ─────────────────────────────────────────────────────────
  {
    "category": "Subscriptions",
    "sortOrder": 1,
    "status": "published",
    "question": "How does the subscription work?",
    "answer": (
      "PesaMatrix charges a flat daily fee for each trading day your copy trading is active.\n\n"
      "Key points:\n"
      "• Subscription duration is measured in trading days (Monday to Friday). Weekends do not count.\n"
      "• You can subscribe for any number of trading days up to the platform maximum.\n"
      "• Your subscription countdown runs only on weekdays — if today is Friday and you subscribe "
      "for 1 day, your subscription is still active on Monday.\n"
      "• When your subscription expires, all copy trading is automatically paused.\n"
      "• You can top up at any time — the new days are added on top of your remaining balance.\n\n"
      "Check your subscription expiry date on the Dashboard or the Subscribe page."
    ),
  },
  {
    "category": "Subscriptions",
    "sortOrder": 2,
    "status": "published",
    "question": "What happens when my subscription expires?",
    "answer": (
      "When your subscription expires:\n\n"
      "1. All your active bindings are automatically suspended — trade copying stops.\n"
      "2. Your slave accounts remain linked to PesaMatrix (you do not need to re-add them).\n"
      "3. You will receive an SMS reminder before expiry (1 day prior and on the day of expiry).\n"
      "4. No trades will be copied until you renew.\n\n"
      "To resume copying: go to the Subscribe page, pay for more trading days via M-Pesa, "
      "and your bindings are reactivated automatically within seconds of payment confirmation."
    ),
  },
  {
    "category": "Subscriptions",
    "sortOrder": 3,
    "status": "published",
    "question": "How do I renew or top up my subscription?",
    "answer": (
      "To renew or extend your subscription:\n\n"
      "1. Log in and go to the Subscribe page (accessible from the dashboard or sidebar).\n"
      "2. Enter the number of trading days you want to pay for.\n"
      "3. The total cost will be displayed based on the current daily rate.\n"
      "4. Enter your Safaricom M-Pesa phone number.\n"
      "5. Tap 'Pay Now' — you will receive an STK Push prompt on your phone.\n"
      "6. Enter your M-Pesa PIN and confirm.\n"
      "7. Your subscription is extended within seconds of payment being confirmed.\n\n"
      "You can renew any time — even if your subscription is still active. "
      "The new days are simply added to your remaining balance."
    ),
  },
  {
    "category": "Subscriptions",
    "sortOrder": 4,
    "status": "published",
    "question": "What is a 'trading day' and how is it counted?",
    "answer": (
      "A trading day is any weekday (Monday through Friday) when the forex market is open.\n\n"
      "Weekends (Saturday and Sunday) are not counted as trading days. "
      "Public holidays may also not count depending on broker market schedules.\n\n"
      "Example: If you subscribe for 5 trading days starting on a Wednesday, "
      "your subscription covers Wednesday, Thursday, Friday, Monday, and Tuesday "
      "(skipping the weekend).\n\n"
      "Your exact expiry date is always shown on the Dashboard so you always know "
      "exactly when your subscription ends."
    ),
  },
  {
    "category": "Subscriptions",
    "sortOrder": 5,
    "status": "published",
    "question": "Can I pause or cancel my subscription?",
    "answer": (
      "There is no manual pause or cancellation feature. Here is how it works:\n\n"
      "• Your subscription counts down automatically each trading day.\n"
      "• When the subscription expires, copy trading stops automatically — you don't need to do anything.\n"
      "• If you want to stop copying trades early, you can manually deactivate your binding "
      "from the Bindings page.\n\n"
      "Subscription fees are non-refundable once paid. "
      "Contact support if you have an exceptional circumstance."
    ),
  },

  # ── Payments ──────────────────────────────────────────────────────────────
  {
    "category": "Payments",
    "sortOrder": 1,
    "status": "published",
    "question": "What payment methods are supported?",
    "answer": (
      "PesaMatrix currently supports M-Pesa STK Push (Lipa Na M-Pesa) as the only payment method.\n\n"
      "You must have a Safaricom M-Pesa line to subscribe. "
      "Other mobile money providers and card payments are not currently supported.\n\n"
      "The payment flow:\n"
      "1. Enter your M-Pesa number on the Subscribe page.\n"
      "2. You receive an STK Push prompt on your phone.\n"
      "3. Enter your M-Pesa PIN to approve.\n"
      "4. Your subscription is activated immediately."
    ),
  },
  {
    "category": "Payments",
    "sortOrder": 2,
    "status": "published",
    "question": "How do I verify a payment manually?",
    "answer": (
      "Payments are normally confirmed automatically within 10–30 seconds. "
      "If the page does not update after you approve the STK Push:\n\n"
      "1. Wait up to 60 seconds — the M-Pesa network can be slow at peak times.\n"
      "2. On the Subscribe page, look for a 'Verify Payment' or 'Check Status' button and tap it.\n"
      "3. The system will query M-Pesa directly to confirm the transaction.\n"
      "4. If the money was deducted from your M-Pesa but your subscription is not updated, "
      "contact support with your M-Pesa transaction message (mpesa_receipt_number).\n\n"
      "You can also check your payment history on the Subscribe page to see all past transactions."
    ),
  },
  {
    "category": "Payments",
    "sortOrder": 3,
    "status": "published",
    "question": "Can I get a refund?",
    "answer": (
      "Subscription payments are generally non-refundable because the service is activated "
      "immediately after payment.\n\n"
      "If you were charged but your subscription was not activated, or if there was a technical "
      "error on our side, contact support immediately with:\n"
      "• Your account email\n"
      "• The M-Pesa transaction message (includes the receipt number, date, and amount)\n\n"
      "We will investigate and credit your account or arrange a resolution if the error was on our part."
    ),
  },
  {
    "category": "Payments",
    "sortOrder": 4,
    "status": "published",
    "question": "How do I check my payment history?",
    "answer": (
      "Your payment history is available on the Subscribe / Payment page in the app.\n\n"
      "It shows:\n"
      "• Date and time of each payment\n"
      "• Amount paid\n"
      "• Number of trading days purchased\n"
      "• Payment status (successful / pending / failed)\n"
      "• M-Pesa receipt number\n\n"
      "Keep your M-Pesa SMS messages as backup receipts — they contain the official "
      "Safaricom transaction reference."
    ),
  },

  # ── M-Pesa ────────────────────────────────────────────────────────────────
  {
    "category": "M-Pesa",
    "sortOrder": 1,
    "status": "published",
    "question": "What is an STK Push and how does it work?",
    "answer": (
      "An STK Push (SIM Toolkit Push) is a payment prompt sent directly to your phone by Safaricom.\n\n"
      "When you tap 'Pay Now' on the Subscribe page:\n"
      "1. PesaMatrix sends a payment request to Safaricom's Daraja API.\n"
      "2. Safaricom sends an on-screen prompt to your phone asking you to enter your M-Pesa PIN.\n"
      "3. You enter your PIN and confirm.\n"
      "4. Safaricom processes the payment and notifies PesaMatrix.\n"
      "5. Your subscription is activated within seconds.\n\n"
      "You do not need to open the M-Pesa app or dial any code — the prompt appears automatically."
    ),
  },
  {
    "category": "M-Pesa",
    "sortOrder": 2,
    "status": "published",
    "question": "The STK Push did not arrive on my phone. What should I do?",
    "answer": (
      "If you do not receive the STK Push within 60 seconds, try the following:\n\n"
      "1. Check your phone has network signal and mobile data is not blocking USSD.\n"
      "2. Make sure your phone is not on Do Not Disturb or call barring mode.\n"
      "3. Confirm you entered the correct M-Pesa number (it must be registered with Safaricom).\n"
      "4. Check your M-Pesa balance is sufficient for the payment.\n"
      "5. Try again — tap 'Pay Now' once more on the Subscribe page.\n"
      "6. If it still fails, dial *334# to check your M-Pesa line status.\n\n"
      "If the push was received, you approved it, money was deducted, but the app didn't update — "
      "use the 'Verify Payment' button or contact support with your M-Pesa SMS receipt."
    ),
  },
  {
    "category": "M-Pesa",
    "sortOrder": 3,
    "status": "published",
    "question": "Which M-Pesa number should I use?",
    "answer": (
      "Use the Safaricom M-Pesa number you want to pay from.\n\n"
      "Important notes:\n"
      "• The number must be a registered Safaricom M-Pesa line.\n"
      "• It does not have to be the same number you registered with on PesaMatrix.\n"
      "• You can pay from a family member's number as long as they approve the STK Push.\n"
      "• Enter the number in the format 07XXXXXXXX or 2547XXXXXXXX — both are accepted.\n"
      "• The number must have sufficient M-Pesa balance to cover the subscription amount."
    ),
  },
  {
    "category": "M-Pesa",
    "sortOrder": 4,
    "status": "published",
    "question": "Is it safe to enter my M-Pesa number on PesaMatrix?",
    "answer": (
      "Yes. PesaMatrix only uses your M-Pesa number to send the STK Push payment request "
      "through Safaricom's official Daraja API.\n\n"
      "Your M-Pesa number is never stored permanently or used for anything else. "
      "PesaMatrix never asks for your M-Pesa PIN — you only enter your PIN on the "
      "official Safaricom prompt that appears directly on your phone.\n\n"
      "If anyone contacts you claiming to be PesaMatrix support and asking for your M-Pesa PIN, "
      "do not share it — that is a scam."
    ),
  },

  # ── Master Accounts ───────────────────────────────────────────────────────
  {
    "category": "Master Accounts",
    "sortOrder": 1,
    "status": "published",
    "question": "How do I become a master trader on PesaMatrix?",
    "answer": (
      "To become a master trader:\n\n"
      "Step 1 — Submit an application\n"
      "  Go to Master Accounts → Add Master Account. Fill in your MT5 account details:\n"
      "  • MT5 Account Number (login ID)\n"
      "  • Investor Password (read-only password — NOT your trading password)\n"
      "  • Broker Server Name\n"
      "  • Display name for your account\n\n"
      "Step 2 — Admin review\n"
      "  The platform admin reviews your application. You will receive an SMS notification "
      "when it is approved or if more information is needed.\n\n"
      "Step 3 — Provisioning\n"
      "  Once approved, PesaMatrix deploys your account on MetaApi and creates a CopyFactory strategy. "
      "This takes 1–5 minutes. The status will progress: Pending → Deploying → Connected.\n\n"
      "Step 4 — Go live\n"
      "  Once your account shows 'Active', your trades are automatically copied to all subscribers "
      "who are bound to your strategy."
    ),
  },
  {
    "category": "Master Accounts",
    "sortOrder": 2,
    "status": "published",
    "question": "What credentials do I need to submit for a master account?",
    "answer": (
      "For a master account, you provide your MT5 investor (read-only) password — "
      "NOT your main trading password.\n\n"
      "The investor password allows MetaApi to:\n"
      "✓ Read your open and closed positions\n"
      "✓ Monitor your trade history\n"
      "✓ Detect new trades in real time\n\n"
      "It cannot:\n"
      "✗ Place or modify trades on your account\n"
      "✗ Withdraw funds\n"
      "✗ Change your account settings\n\n"
      "To find your investor password in MT5:\n"
      "1. Open MetaTrader 5.\n"
      "2. Go to Tools → Options → Server.\n"
      "3. Your investor password is shown there, or ask your broker to provide one.\n\n"
      "Also needed: your MT5 account number (login ID) and the exact broker server name "
      "(e.g. Exness-Real3, XMGlobal-MT5)."
    ),
  },
  {
    "category": "Master Accounts",
    "sortOrder": 3,
    "status": "published",
    "question": "What is the master account lifecycle and what do the statuses mean?",
    "answer": (
      "A master account goes through several stages after submission:\n\n"
      "• Pending — Your application has been submitted and is waiting for admin review.\n"
      "• Approved — Admin approved it; provisioning on MetaApi is starting.\n"
      "• Deploying — MetaApi is setting up the cloud container for your account.\n"
      "• Deployed — Container is ready; trying to connect to your MT5 broker.\n"
      "• Connecting — Logging in to your MT5 server with your credentials.\n"
      "• Connected — Successfully connected; account is live and being monitored.\n"
      "• Active — Fully operational; trades are being copied to subscribers.\n"
      "• Failed — Connection failed (wrong credentials or server). Check your details.\n"
      "• Suspended — Admin has temporarily suspended the account.\n\n"
      "You can see the current status on the Master Accounts page. "
      "Tap 'Refresh Status' to get the latest update from MetaApi."
    ),
  },
  {
    "category": "Master Accounts",
    "sortOrder": 4,
    "status": "published",
    "question": "Can I have more than one master account?",
    "answer": (
      "You can submit multiple master account applications, but each account must be "
      "approved separately by the platform admin.\n\n"
      "Each approved master account creates its own strategy in CopyFactory, and "
      "subscribers can choose which strategy to follow.\n\n"
      "Note: Each MT5 account number can only be registered once on the platform. "
      "You cannot add the same account twice."
    ),
  },

  # ── Slave Accounts ────────────────────────────────────────────────────────
  {
    "category": "Slave Accounts",
    "sortOrder": 1,
    "status": "published",
    "question": "What is a slave account?",
    "answer": (
      "A slave account (also called a follower account) is your MT5 trading account "
      "that receives the copied trades from a master account.\n\n"
      "When you add a slave account to PesaMatrix:\n"
      "• MetaApi connects to your account using your investor (read-only) password.\n"
      "• When a master trader opens a trade, the same trade is opened on your slave account.\n"
      "• When the master closes or modifies a trade, your copy is updated to match.\n\n"
      "You can have different lot sizes from the master by setting a risk multiplier on your binding."
    ),
  },
  {
    "category": "Slave Accounts",
    "sortOrder": 2,
    "status": "published",
    "question": "How do I add a slave account? (Step-by-step)",
    "answer": (
      "Step 1 — Go to Slave Accounts\n"
      "  From the sidebar, tap 'Slave Accounts', then tap 'Add Slave Account'.\n\n"
      "Step 2 — Fill in your MT5 details\n"
      "  • Account Number: Your MT5 login ID (e.g. 12345678)\n"
      "  • Investor Password: Your read-only MT5 password (see note below)\n"
      "  • Server Name: Your broker's server name exactly as shown in MT5 "
      "(e.g. Exness-Real3, XMGlobal-MT5 4)\n"
      "  • Display Name: A name to identify this account (e.g. 'My Exness Account')\n\n"
      "Step 3 — Submit\n"
      "  Tap 'Add Account'. The account will show 'Deploying' or 'Connecting' for 1–3 minutes "
      "while MetaApi establishes the connection.\n\n"
      "Step 4 — Verify connection\n"
      "  Once the status shows 'Connected', your account is ready. "
      "Copy trading will begin automatically if your subscription is active.\n\n"
      "Note: To find your investor password, open MT5 → Tools → Options → Server, "
      "or contact your broker's support."
    ),
  },
  {
    "category": "Slave Accounts",
    "sortOrder": 3,
    "status": "published",
    "question": "What is the investor password and why do you need it?",
    "answer": (
      "The investor password is a read-only password for your MT5 account, separate from "
      "your main trading password.\n\n"
      "PesaMatrix uses the investor password so MetaApi can:\n"
      "✓ Receive and execute copied trades on your account\n"
      "✓ Monitor your account balance and positions\n\n"
      "With only the investor password, MetaApi and PesaMatrix CANNOT:\n"
      "✗ Place unauthorised manual trades\n"
      "✗ Withdraw or transfer your funds\n"
      "✗ Change your account password or settings\n\n"
      "How to find or set your investor password:\n"
      "• In MetaTrader 5: Tools → Options → Server → Investor Password\n"
      "• Via your broker's client portal or support team\n"
      "• Some brokers automatically provide it when you open an account\n\n"
      "Never share your main trading password with anyone."
    ),
  },
  {
    "category": "Slave Accounts",
    "sortOrder": 4,
    "status": "published",
    "question": "What broker and account type should I use for my slave account?",
    "answer": (
      "PesaMatrix works with any MT5 broker supported by MetaApi.\n\n"
      "Recommended account types:\n"
      "• Raw spread or ECN accounts (lower costs since trades are frequent)\n"
      "• Standard accounts also work fine\n"
      "• Avoid accounts with very high minimum lot sizes (e.g. 0.1 lots minimum) "
      "as this can cause issues with small copied lots\n\n"
      "Popular compatible brokers: Exness, XM, FBS, IC Markets, Pepperstone, Tickmill.\n\n"
      "Make sure your account is an MT5 account — MT4 accounts are not supported."
    ),
  },
  {
    "category": "Slave Accounts",
    "sortOrder": 5,
    "status": "published",
    "question": "Can I have more than one slave account?",
    "answer": (
      "You can add multiple slave accounts to your PesaMatrix profile. "
      "Each must be connected and verified separately.\n\n"
      "However, each subscription is typically linked to the platform's active strategy and "
      "all connected slave accounts are bound to it when you pay.\n\n"
      "If you want to manage which slave accounts are active, use the Bindings page to "
      "activate or deactivate individual account-to-strategy connections.\n\n"
      "Note: The same MT5 account number cannot be registered under two different "
      "PesaMatrix accounts."
    ),
  },

  # ── Copy Trading ──────────────────────────────────────────────────────────
  {
    "category": "Copy Trading",
    "sortOrder": 1,
    "status": "published",
    "question": "How does copy trading work on PesaMatrix?",
    "answer": (
      "Copy trading on PesaMatrix works through a system of Masters, Strategies, and Bindings:\n\n"
      "1. Master Account — An approved trader's MT5 account that PesaMatrix monitors via MetaApi.\n\n"
      "2. Strategy — A named copy trading configuration linked to a master account. "
      "Subscribers follow a strategy, not the master account directly.\n\n"
      "3. Binding — The connection between your slave account and a strategy. "
      "When a binding is active, every trade the master opens is replicated to your account.\n\n"
      "The flow:\n"
      "Master opens trade → MetaApi detects it instantly → CopyFactory replicates it to "
      "all bound slave accounts → Trade appears in your MT5 account within seconds."
    ),
  },
  {
    "category": "Copy Trading",
    "sortOrder": 2,
    "status": "published",
    "question": "What is a binding and how do I manage it?",
    "answer": (
      "A binding is the link between your slave account and a copy trading strategy.\n\n"
      "When you have an active subscription, a binding is created automatically. "
      "You can also manage bindings manually from the Bindings page:\n\n"
      "• View all your bindings and their status (Active / Suspended)\n"
      "• Activate or deactivate a binding\n"
      "• Set the risk multiplier (lot size scaling)\n"
      "• View the strategy each binding is connected to\n\n"
      "A binding must be Active AND your subscription must be active for trades to copy. "
      "If either is inactive, copying stops."
    ),
  },
  {
    "category": "Copy Trading",
    "sortOrder": 3,
    "status": "published",
    "question": "What is the risk multiplier and how should I set it?",
    "answer": (
      "The risk multiplier controls how the master's lot sizes are scaled when copied to your account.\n\n"
      "Examples:\n"
      "• 1.0 = Copy exact same lot size as the master (e.g. master opens 1.0 lot → you get 1.0 lot)\n"
      "• 0.5 = Copy half the master's lots (e.g. master opens 1.0 lot → you get 0.5 lots)\n"
      "• 2.0 = Copy double the master's lots (higher risk and potential reward)\n"
      "• 0.1 = Very small copies (good for testing or small account balances)\n\n"
      "Recommendation:\n"
      "Start with 0.5 or 1.0. Lower multipliers reduce risk but also reduce potential profit. "
      "Higher multipliers amplify both gains and losses. "
      "Match the multiplier to your account balance relative to the master's — "
      "if your account is much smaller, use a lower multiplier."
    ),
  },
  {
    "category": "Copy Trading",
    "sortOrder": 4,
    "status": "published",
    "question": "Does PesaMatrix guarantee profits?",
    "answer": (
      "No. PesaMatrix is a technology platform — it does not provide financial advice and "
      "cannot guarantee any returns.\n\n"
      "Important risk warnings:\n"
      "• Forex and CFD trading carries significant risk of loss.\n"
      "• Past performance of a master trader does not guarantee future results.\n"
      "• Market conditions can change rapidly and trades can result in losses.\n"
      "• You should only trade with money you can afford to lose.\n\n"
      "PesaMatrix provides the copy trading infrastructure. The trading decisions are made "
      "by the master trader, and outcomes depend on market conditions beyond anyone's control.\n\n"
      "Always do your own research before choosing a strategy to follow."
    ),
  },
  {
    "category": "Copy Trading",
    "sortOrder": 5,
    "status": "published",
    "question": "Where can I see the trades that have been copied to my account?",
    "answer": (
      "You can view your copied trade history in two places:\n\n"
      "1. Trade Logs page (in PesaMatrix)\n"
      "   Shows all trades copied to your slave account, including open time, symbol, "
      "lot size, direction (Buy/Sell), and profit/loss.\n\n"
      "2. Your MT5 account directly\n"
      "   Open MetaTrader 5 and log in to your slave account to see all open and "
      "closed positions in real time, including detailed P&L.\n\n"
      "Note: There may be a small delay (seconds to a minute) between the master "
      "opening a trade and it appearing on your account depending on your broker's speed."
    ),
  },

  # ── MetaApi Connection ────────────────────────────────────────────────────
  {
    "category": "MetaApi Connection",
    "sortOrder": 1,
    "status": "published",
    "question": "What is MetaApi and why does PesaMatrix use it?",
    "answer": (
      "MetaApi is a cloud service that provides programmatic access to MetaTrader 5 accounts "
      "via a secure API. PesaMatrix uses MetaApi to:\n\n"
      "• Connect to master accounts and detect trades in real time\n"
      "• Connect to slave accounts and execute copied trades\n"
      "• Monitor account health and connection status\n"
      "• Manage CopyFactory — MetaApi's built-in trade copying infrastructure\n\n"
      "MetaApi acts as a secure middleman between PesaMatrix and your broker's MT5 server. "
      "Your credentials are encrypted and never exposed. "
      "MetaApi is used by thousands of professional trading platforms worldwide."
    ),
  },
  {
    "category": "MetaApi Connection",
    "sortOrder": 2,
    "status": "published",
    "question": "What do the different connection statuses mean?",
    "answer": (
      "Your slave or master account will show one of these statuses:\n\n"
      "• Deploying — MetaApi is creating a cloud container for your account. (1–2 min)\n"
      "• Deployed — Container ready; attempting to log in to your MT5 broker server.\n"
      "• Connecting — Logging in with your credentials. (Up to 2 min)\n"
      "• Connected — Fully connected and synchronised. Trades will copy normally.\n"
      "• Disconnected — Connection lost. MetaApi will try to reconnect automatically.\n"
      "• Failed — Could not connect. Usually means wrong password or server name.\n\n"
      "Copy trading only works when the status is 'Connected'. "
      "The status updates automatically — you can also tap 'Refresh' to check the latest."
    ),
  },
  {
    "category": "MetaApi Connection",
    "sortOrder": 3,
    "status": "published",
    "question": "Why is my account stuck on 'Connecting' or 'Deploying'?",
    "answer": (
      "This is usually temporary. Here is what to check:\n\n"
      "If stuck on Deploying (more than 5 minutes):\n"
      "• This is rare — contact support.\n\n"
      "If stuck on Connecting (more than 10 minutes):\n"
      "1. Verify your investor password is correct — log in to MT5 manually to confirm.\n"
      "2. Verify the broker server name exactly — it must match what appears in MT5 "
      "(e.g. 'Exness-Real3' not 'Exness Real 3').\n"
      "3. Check your broker's server is online — some brokers have maintenance windows.\n"
      "4. If your broker uses a VPN or restricted servers, MetaApi may not be able to connect.\n\n"
      "You can try deleting and re-adding the account with corrected credentials. "
      "If the problem persists, contact support with your account details."
    ),
  },
  {
    "category": "MetaApi Connection",
    "sortOrder": 4,
    "status": "published",
    "question": "How long does it take for my account to connect?",
    "answer": (
      "Most accounts connect within 1–3 minutes. Here is a typical timeline:\n\n"
      "• 0–60 seconds: Deploying (MetaApi sets up the cloud container)\n"
      "• 1–2 minutes: Connecting (logging in to your broker's MT5 server)\n"
      "• Connected: Account is live\n\n"
      "Some brokers with slower or geographically distant servers can take up to 5 minutes. "
      "If your account has not connected after 10 minutes, check your credentials and "
      "server name, or contact support."
    ),
  },
  {
    "category": "MetaApi Connection",
    "sortOrder": 5,
    "status": "published",
    "question": "My account shows 'Failed'. What should I do?",
    "answer": (
      "A 'Failed' status almost always means one of these issues:\n\n"
      "1. Wrong investor password — Double-check it in MT5 under Tools → Options → Server.\n"
      "2. Wrong server name — The server name must exactly match what MT5 shows. "
      "Look in MT5 at File → Login to Trading Account to see your server.\n"
      "3. Account suspended by broker — Log in to MT5 directly to check.\n"
      "4. Broker server maintenance — Try again in a few hours.\n\n"
      "To fix: go to your Slave Accounts page, delete the failed account, and re-add it "
      "with the correct details. If you continue to have issues, contact support."
    ),
  },

  # ── Promotions & Referrals ────────────────────────────────────────────────
  {
    "category": "Promotions & Referrals",
    "sortOrder": 1,
    "status": "published",
    "question": "How does the referral programme work?",
    "answer": (
      "PesaMatrix rewards you for referring friends who sign up and subscribe.\n\n"
      "How it works:\n"
      "1. Go to the Referrals page to find your unique referral link or code.\n"
      "2. Share your link or code with friends via WhatsApp, SMS, or social media.\n"
      "3. When a friend registers using your code and makes their first payment, "
      "you earn a referral reward.\n"
      "4. Rewards are credited to your account and can extend your subscription days.\n\n"
      "The more active referrals you make, the more rewards you earn. "
      "Check the Referrals page for your current reward tiers and how much you have earned."
    ),
  },
  {
    "category": "Promotions & Referrals",
    "sortOrder": 2,
    "status": "published",
    "question": "How do I share my referral link?",
    "answer": (
      "Go to the Referrals page in the app:\n\n"
      "1. Tap the copy icon next to your referral link to copy it to your clipboard.\n"
      "2. Share it on WhatsApp, SMS, Telegram, Facebook, or any other channel.\n"
      "3. Alternatively, share your referral code — your friend enters it during registration.\n\n"
      "Your friend must register using your link or code for the referral to be tracked. "
      "If they register without it, the referral cannot be applied retroactively."
    ),
  },
  {
    "category": "Promotions & Referrals",
    "sortOrder": 3,
    "status": "published",
    "question": "When do I receive my referral reward?",
    "answer": (
      "Referral rewards are credited to your account when your referred friend "
      "makes their first subscription payment.\n\n"
      "The reward is in the form of additional trading days added to your subscription.\n"
      "The number of days depends on how many successful referrals you have made — "
      "more referrals unlock higher reward tiers.\n\n"
      "You can track your referral status and pending rewards on the Referrals page. "
      "You will also receive an SMS notification when a reward is credited."
    ),
  },

  # ── Security ──────────────────────────────────────────────────────────────
  {
    "category": "Security",
    "sortOrder": 1,
    "status": "published",
    "question": "Is my trading account safe with PesaMatrix?",
    "answer": (
      "Yes. PesaMatrix is designed with your account security as a top priority.\n\n"
      "Key safeguards:\n"
      "• Only your investor (read-only) password is used — PesaMatrix cannot withdraw funds "
      "or make unauthorised trades.\n"
      "• All credentials are stored encrypted using AES-256 encryption.\n"
      "• All data in transit is protected with TLS/SSL encryption.\n"
      "• PesaMatrix never asks for your main trading password.\n"
      "• JWT authentication is used for all API requests — your session is secure.\n\n"
      "If you suspect your account has been compromised, change your MT5 investor password "
      "immediately from MetaTrader 5, and contact PesaMatrix support."
    ),
  },
  {
    "category": "Security",
    "sortOrder": 2,
    "status": "published",
    "question": "What information does PesaMatrix store about me?",
    "answer": (
      "PesaMatrix stores the following information:\n\n"
      "• Account: Name, email address, phone number, and hashed password (we never store plain text passwords).\n"
      "• MT5 credentials: Account number, investor password (encrypted), and server name — "
      "for slave and master accounts.\n"
      "• Payment records: M-Pesa transaction references and subscription history.\n"
      "• Trade logs: A record of trades copied to your account.\n\n"
      "We do not store your M-Pesa PIN, your main MT5 trading password, or any financial data "
      "beyond what is needed to operate the service."
    ),
  },
  {
    "category": "Security",
    "sortOrder": 3,
    "status": "published",
    "question": "How do I change my PesaMatrix password?",
    "answer": (
      "To change your password:\n\n"
      "Option 1 — From within the app:\n"
      "  Go to Settings or your profile page. Look for 'Change Password'. "
      "Enter your current password, then your new password twice, and save.\n\n"
      "Option 2 — If you forgot your password:\n"
      "  On the Login page, tap 'Forgot Password'. Enter your email address. "
      "You will receive a password reset link via email. "
      "Click the link and set a new password.\n\n"
      "Choose a strong password: at least 8 characters, mix of letters, numbers, and symbols. "
      "Do not reuse passwords from other services."
    ),
  },
  {
    "category": "Security",
    "sortOrder": 4,
    "status": "published",
    "question": "What should I do if I suspect unauthorised access to my account?",
    "answer": (
      "Take these steps immediately:\n\n"
      "1. Change your PesaMatrix password from the Settings page or via 'Forgot Password' on the login page.\n"
      "2. Change your MT5 investor password from within MetaTrader 5 "
      "(Tools → Options → Server → Change Investor Password).\n"
      "3. Check your payment history on the Subscribe page for any unexpected transactions.\n"
      "4. Check your slave account Bindings to confirm they are as expected.\n"
      "5. Contact PesaMatrix support immediately with your account email and a description of what you noticed.\n\n"
      "PesaMatrix support will never ask for your password — never share it with anyone."
    ),
  },

  # ── Technical Support ─────────────────────────────────────────────────────
  {
    "category": "Technical Support",
    "sortOrder": 1,
    "status": "published",
    "question": "Copy trading has stopped. What should I check?",
    "answer": (
      "If trades are no longer being copied, work through this checklist:\n\n"
      "1. Subscription active?\n"
      "   Check your Dashboard — your subscription must not be expired.\n\n"
      "2. Slave account Connected?\n"
      "   Go to Slave Accounts — the status must show 'Connected', not 'Failed' or 'Disconnected'.\n\n"
      "3. Binding Active?\n"
      "   Go to Bindings — the binding between your slave account and the strategy must be 'Active'.\n\n"
      "4. Master account Active?\n"
      "   Check if the master account you are following is still active and Connected.\n\n"
      "5. Is the master trading?\n"
      "   Sometimes there are simply no trades from the master — check the Trade Logs to see "
      "if any recent trades exist.\n\n"
      "If all of the above are correct and trades are still not copying, contact support."
    ),
  },
  {
    "category": "Technical Support",
    "sortOrder": 2,
    "status": "published",
    "question": "How do I contact support?",
    "answer": (
      "You can reach PesaMatrix support through the Contacts page within the app.\n\n"
      "When contacting support, include:\n"
      "• Your registered email address\n"
      "• A clear description of the problem\n"
      "• Any error messages you see (screenshot if possible)\n"
      "• For payment issues: your M-Pesa SMS receipt (includes transaction reference)\n"
      "• For connection issues: your slave account number and broker server name\n\n"
      "Our support team typically responds within a few hours during business hours (Mon–Fri, EAT)."
    ),
  },
  {
    "category": "Technical Support",
    "sortOrder": 3,
    "status": "published",
    "question": "I cannot log in to my PesaMatrix account. What should I do?",
    "answer": (
      "Try the following steps:\n\n"
      "1. Confirm you are using the correct email address.\n"
      "2. Check your password — it is case-sensitive.\n"
      "3. If you have forgotten your password, tap 'Forgot Password' on the login page and "
      "follow the email reset link.\n"
      "4. Clear your browser cache or try a different browser / device.\n"
      "5. If you see an 'Account suspended' message, contact support.\n\n"
      "If none of these work, contact support with your registered email address and "
      "a description of the error message you see."
    ),
  },
  {
    "category": "Technical Support",
    "sortOrder": 4,
    "status": "published",
    "question": "Why am I not receiving SMS notifications?",
    "answer": (
      "If you are not receiving SMS messages (OTPs, subscription alerts, etc.):\n\n"
      "1. Check your phone has network signal and SMS is not blocked.\n"
      "2. Ensure the phone number on your PesaMatrix account is correct "
      "(check under your profile settings).\n"
      "3. Check your notification preferences — go to Settings → Notifications and "
      "confirm SMS notifications are enabled.\n"
      "4. Check if your phone has blocked the sender number.\n"
      "5. For OTP specifically: tap 'Resend OTP' and wait 60 seconds.\n\n"
      "If SMS still does not arrive, contact support — the SMS service may need attention."
    ),
  },
  {
    "category": "Technical Support",
    "sortOrder": 5,
    "status": "published",
    "question": "The app is slow or showing errors. What should I do?",
    "answer": (
      "For general app performance or errors:\n\n"
      "1. Refresh the page (press F5 or pull down to refresh on mobile).\n"
      "2. Check your internet connection.\n"
      "3. Clear your browser cache and cookies, then reload.\n"
      "4. Try a different browser (Chrome or Firefox recommended).\n"
      "5. Try on a different device or network.\n\n"
      "If you see a specific error message, note it down and contact support. "
      "Include the page you were on, what you were trying to do, and the exact error text."
    ),
  },
]

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Logging in...")
    token = login()
    print(f"✓ Logged in")

    total = len(FAQS)
    for i, faq in enumerate(FAQS, 1):
        result = post_faq(token, faq)
        print(f"  [{i:02d}/{total}] [{faq['category']}] {faq['question'][:60]}")

    print(f"\n✓ Done — inserted {total} FAQs successfully.")

if __name__ == "__main__":
    main()
