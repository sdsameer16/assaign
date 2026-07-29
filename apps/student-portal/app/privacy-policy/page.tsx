export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Privacy Policy</h1>

        <div className="prose prose-slate text-sm space-y-4">
          <p className="text-slate-600">
            <strong>Last updated:</strong> July 2026
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6">1. What We Do</h2>
          <p className="text-slate-600">
            CampusBites is a campus food delivery service. We only deliver orders placed through our
            platform — we do not prepare or manufacture any food items.
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6">2. Information We Collect</h2>
          <ul className="list-disc pl-5 text-slate-600 space-y-1">
            <li><strong>Mobile number</strong> — used for login and delivery coordination.</li>
            <li><strong>Name and roll number</strong> — used for identity verification.</li>
            <li><strong>ID card image</strong> — processed via OCR for verification and stored securely.</li>
            <li><strong>Room/building details</strong> — used to deliver your order to the correct location.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 text-slate-600 space-y-1">
            <li>To verify your identity as a registered student.</li>
            <li>To process and deliver your orders.</li>
            <li>To contact you at the time of delivery (phone call only).</li>
            <li>We use your phone number for promotions.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6">4. What We Do NOT Do</h2>
          <ul className="list-disc pl-5 text-slate-600 space-y-1">
            
            <li>We do <strong>not</strong> sell or share your personal information with third parties.</li>
            <li>We do <strong>not</strong> store payment card details — payments are processed securely by Razorpay.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6">5. Data Security</h2>
          <p className="text-slate-600">
            Your data is stored securely and access is restricted to authorized personnel only.
            We use encryption for sensitive data in transit and at rest.
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6">6. Contact</h2>
          <p className="text-slate-600">
            If you have questions about this policy, please contact the CampusBites team through
            the support section in the app.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <a
            href="/"
            className="text-orange-600 font-semibold text-sm hover:underline"
          >
            ← Back to CampusBites
          </a>
        </div>
      </div>
    </div>
  );
}
