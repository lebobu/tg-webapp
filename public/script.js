async function submitOrder(payload) {
  try {
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error('Ошибка оформления');
    }

    alert(`Заказ оформлен: ${result.orderId}`);

  } catch (e) {
    console.error(e);
    alert('Ошибка соединения');
  }
}