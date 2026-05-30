// /dashboard/src/razorpay.js

export function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({ planName, amount, description }) {
  const loaded = await loadRazorpay();
  if (!loaded) {
    alert('Razorpay SDK failed to load. Check your internet connection.');
    return;
  }

  const options = {
    key: 'rzp_test_SmzSUsgbIGT8MX', 
    amount: amount * 100,         // Razorpay expects paise (₹ × 100)
    currency: 'INR',
    name: 'LogWatchAI',
    description: description,
    image: '',                    // Optional: your logo URL
    handler: function (response) {
      alert(`✅ Payment successful!\nPayment ID: ${response.razorpay_payment_id}`);
      // TODO: Call your backend to verify & activate the plan
    },
    prefill: {
      name: '',
      email: '',
    },
    theme: {
      color: '#00dc9b',
    },
    modal: {
      ondismiss: () => {
        console.log('Payment modal closed');
      },
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}