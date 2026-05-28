(function () {
  "use strict";

  var form = document.getElementById("contactReplicaForm");
  if (!form) {
    return;
  }

  var fileCapWarn = document.getElementById("contactSmartcaptchaFileWarning");
  if (fileCapWarn && window.location && String(window.location.protocol) === "file:") {
    fileCapWarn.hidden = false;
  }

  var capContainer = document.getElementById("contactSmartcaptcha");
  var capHint = document.getElementById("contactSmartcaptchaHint");
  var capSitekey = capContainer
    ? String(capContainer.getAttribute("data-sitekey") || "")
        .trim()
    : "";
  var capWidgetId = null;
  var capInitTries = 0;

  /** Русские тексты встроенной проверки (setCustomValidity), иначе Chrome показывает EN. */
  var validityMsg = {
    contactFirstName: {
      valueMissing: "Пожалуйста, введите имя.",
      tooLong: "Сократите имя: не более 40 символов.",
    },
    contactLastName: {
      tooLong: "Сократите фамилию: не более 40 символов.",
    },
    contactCompany: {
      valueMissing: "Пожалуйста, введите название компании.",
      tooLong: "Сократите название: не более 40 символов.",
    },
    contactCity: {
      tooLong: "Сократите название города: не более 40 символов.",
    },
    contactPhone: {
      valueMissing: "Пожалуйста, введите телефон.",
      tooLong: "Сократите телефон: не более 40 символов.",
    },
    contactEmail: {
      valueMissing: "Пожалуйста, введите адрес электронной почты.",
      typeMismatch: "Введите корректный адрес e-mail, например имя@пример.рф.",
      tooLong: "Сократите e-mail: не более 40 символов.",
    },
    contactComment: {
      valueMissing: "Пожалуйста, введите комментарий.",
      tooLong: "Сократите комментарий: не более 1000 символов.",
    },
  };

  function applyRussianValidityMessage(el) {
    var m = validityMsg[el.id];
    if (!m) {
      el.setCustomValidity("Проверьте введённое значение в этом поле.");
      return;
    }
    if (el.validity.valueMissing && m.valueMissing) {
      el.setCustomValidity(m.valueMissing);
      return;
    }
    if (el.id === "contactEmail" && el.validity.typeMismatch && m.typeMismatch) {
      el.setCustomValidity(m.typeMismatch);
      return;
    }
    if (el.validity.tooLong && m.tooLong) {
      el.setCustomValidity(m.tooLong);
      return;
    }
    if (!el.validity.valid) {
      el.setCustomValidity("Проверьте введённое значение в этом поле.");
    }
  }

  function initRussianConstraintMessages(root) {
    var controls = root.querySelectorAll("input, textarea, select");
    for (var i = 0; i < controls.length; i += 1) {
      (function (el) {
        if (
          el.id === "contactWebsiteHp" ||
          (el.getAttribute("type") || "").toLowerCase() === "hidden" ||
          (el.getAttribute("type") || "").toLowerCase() === "submit" ||
          el.hasAttribute("data-skip-ru-validity")
        ) {
          return;
        }
        el.addEventListener("invalid", function () {
          el.setCustomValidity("");
          if (!el.validity.valid) {
            applyRussianValidityMessage(el);
          }
        });
        el.addEventListener("input", function () {
          el.setCustomValidity("");
        });
        el.addEventListener("change", function () {
          el.setCustomValidity("");
        });
      })(controls[i]);
    }
  }

  initRussianConstraintMessages(form);

  var submitBtn = form.querySelector('input[type="submit"]');
  var statusEl = document.getElementById("contactFormStatus");
  var hp = document.getElementById("contactWebsiteHp");
  var textarea = document.getElementById("contactComment");
  var charsLeftEl = document.getElementById("contactCharsLeft");
  var maxLen = textarea ? parseInt(textarea.getAttribute("maxlength") || "1000", 10) : 1000;

  function setStatus(type, text) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = text;
    statusEl.classList.remove("contact-page-eu-form-status--ok", "contact-page-eu-form-status--err");
    statusEl.classList.add(type === "err" ? "contact-page-eu-form-status--err" : "contact-page-eu-form-status--ok");
    statusEl.classList.add("is-visible");
    statusEl.hidden = false;
  }

  function clearStatusClass() {
    if (!statusEl) {
      return;
    }
    statusEl.classList.remove("is-visible", "contact-page-eu-form-status--ok", "contact-page-eu-form-status--err");
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  function messageForError(code) {
    var map = {
      required: "Заполните обязательные поля и проверьте формат e-mail.",
      email: "Укажите корректный адрес e-mail.",
      rate: "Слишком много заявок с вашего соединения. Попробуйте позже.",
      temporary: "Форма временно недоступна. Попробуйте позже.",
      too_large: "Сообщение слишком большое. Сократите текст и повторите попытку.",
      send: "Не удалось отправить сообщение. Попробуйте позже или свяжитесь по телефону.",
      server_config: "Сервер не настроен на отправку почты. Обратитесь к администратору сайта.",
      json: "Некорректные данные формы. Обновите страницу и повторите попытку.",
      captcha: "Проверка Yandex Smart Captcha не пройдена. Обновите проверку и повторите попытку.",
    };
    return map[code] || "Не удалось отправить форму. Попробуйте позже.";
  }

  function updateCharsLeft() {
    if (!textarea || !charsLeftEl) {
      return;
    }
    var left = maxLen - textarea.value.length;
    if (left < 0) {
      left = 0;
    }
    charsLeftEl.textContent = String(left);
  }

  if (submitBtn) {
    submitBtn.disabled = true;
  }

  function resetYandexWidget() {
    if (!window.smartCaptcha || capWidgetId === null) {
      return;
    }
    try {
      window.smartCaptcha.reset(capWidgetId);
    } catch (e) {
      // ignore
    }
  }

  function lockSubmitUntilCaptcha() {
    if (submitBtn) {
      submitBtn.disabled = true;
    }
  }

  if (!capSitekey) {
    if (capHint) {
      capHint.hidden = false;
    }
  } else {
    function startSmartCaptcha() {
      if (!window.smartCaptcha || typeof window.smartCaptcha.render !== "function" || !capContainer) {
        return false;
      }
      try {
        capWidgetId = window.smartCaptcha.render(capContainer, {
          sitekey: capSitekey,
          hl: "ru",
          callback: function () {
            if (submitBtn) {
              submitBtn.disabled = false;
            }
            clearStatusClass();
          },
        });
      } catch (e) {
        setStatus("err", "Не удалось показать Yandex Smart Captcha. Попробуйте обновить страницу.");
        return true;
      }
      if (typeof window.smartCaptcha.subscribe === "function" && capWidgetId !== null) {
        window.smartCaptcha.subscribe(capWidgetId, "token-expired", function () {
          lockSubmitUntilCaptcha();
        });
      }
      return true;
    }

    function tryLoadSmartCaptcha() {
      if (startSmartCaptcha()) {
        return;
      }
      capInitTries += 1;
      if (capInitTries > 120) {
        setStatus(
          "err",
          "Не удалось загрузить Yandex Smart Captcha. Проверьте сеть, блокировщики и обновите страницу."
        );
        return;
      }
      setTimeout(tryLoadSmartCaptcha, 50);
    }
    tryLoadSmartCaptcha();
  }

  if (textarea) {
    textarea.addEventListener("input", updateCharsLeft);
    updateCharsLeft();
  }

  var resetBtn = document.getElementById("contactReplicaReset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function (e) {
      e.preventDefault();
      form.reset();
      clearStatusClass();
      if (hp) {
        hp.value = "";
      }
      updateCharsLeft();
      resetYandexWidget();
      lockSubmitUntilCaptcha();
    });
  }

  function getCaptchaToken() {
    if (!capSitekey || !window.smartCaptcha) {
      return "";
    }
    if (capWidgetId === null) {
      if (typeof window.smartCaptcha.getResponse === "function") {
        return String(window.smartCaptcha.getResponse() || "");
      }
      return "";
    }
    if (typeof window.smartCaptcha.getResponse === "function") {
      return String(window.smartCaptcha.getResponse(capWidgetId) || "");
    }
    return "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearStatusClass();

    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      return;
    }

    if (hp && String(hp.value).trim() !== "") {
      setStatus("ok", "Сообщение отправлено.");
      return;
    }

    if (capSitekey) {
      var t = getCaptchaToken();
      if (!t) {
        setStatus("err", "Пожалуйста, пройдите проверку Yandex Smart Captcha.");
        return;
      }
    } else {
      setStatus("err", "Капча не настроена на странице. Обратитесь к владельцу сайта.");
      return;
    }

    var payload = {
      firstName: (document.getElementById("contactFirstName") || {}).value || "",
      lastName: (document.getElementById("contactLastName") || {}).value || "",
      company: (document.getElementById("contactCompany") || {}).value || "",
      city: (document.getElementById("contactCity") || {}).value || "",
      phone: (document.getElementById("contactPhone") || {}).value || "",
      email: (document.getElementById("contactEmail") || {}).value || "",
      comment: (document.getElementById("contactComment") || {}).value || "",
      companyWebsite: hp ? String(hp.value) : "",
      captchaToken: getCaptchaToken(),
    };

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    var apiUrl = "api/submit.php";
    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { res: res, data: data };
          });
      })
      .then(function (result) {
        var res = result.res;
        var data = result.data;
        if (res.ok && data && data.ok) {
          setStatus("ok", "Спасибо! Сообщение отправлено. Мы свяжемся с вами.");
          form.reset();
          if (hp) {
            hp.value = "";
          }
          updateCharsLeft();
        } else {
          var err = (data && data.error) || "";
          setStatus("err", messageForError(err));
        }
      })
      .catch(function () {
        setStatus("err", "Ошибка сети. Проверьте соединение и повторите попытку.");
      })
      .finally(function () {
        resetYandexWidget();
        lockSubmitUntilCaptcha();
      });
  });
})();
