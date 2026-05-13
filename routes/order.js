const express = require('express');
      email: emailStr,
      plan,
      accounts,
      duration,
      pricing
    };

    const BRAND = {
      name:
        process.env.BRAND_NAME ||
        'Web Service',

      logo:
        process.env.BRAND_LOGO_URL || '',

      primary:
        process.env.BRAND_PRIMARY || '#0a84ff',

      supportEmail:
        process.env.SUPPORT_EMAIL || ''
    };

    const { admin, user } = buildOrderEmail({
      brand: BRAND,
      order
    });

    const ADMIN_EMAIL = (
      process.env.ADMIN_EMAIL || ''
    ).trim();

    if (ADMIN_EMAIL) {
      await sendMail({
        to: ADMIN_EMAIL,
        subject: admin.subject,
        text: admin.text,
        html: admin.html
      });
    }

    if (isValidEmail(emailStr)) {
      await sendMail({
        to: emailStr,
        subject: user.subject,
        text: user.text,
        html: user.html
      });
    }

    res.json({
      ok: true,
      orderId
    });

  } catch (e) {
    console.error('order error:', e);

    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;