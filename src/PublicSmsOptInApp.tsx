import { BrowserRouter, Route, Routes } from "react-router-dom";
import SmsOptIn from "./pages/SmsOptIn";

/**
 * Public-only app shell for Twilio SMS opt-in verification.
 * This intentionally excludes AuthProvider and protected app chrome.
 */
export default function PublicSmsOptInApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sms-opt-in" element={<SmsOptIn />} />
        <Route path="/sms-opt-in/:tenantId" element={<SmsOptIn />} />
        <Route path="/sms/opt-in" element={<SmsOptIn />} />
        <Route path="/sms/opt-in/:tenantId" element={<SmsOptIn />} />
      </Routes>
    </BrowserRouter>
  );
}
