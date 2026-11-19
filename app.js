// ========================================================
// MIDNI - LÓGICA PRINCIPAL DE LA APLICACIÓN
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. Iniciar animación de ondas
  initWavesAnimation("waves-canvas");
  initWavesAnimation("dni-waves-canvas");
  initWavesAnimation("qr-waves-canvas");

  const splashScreen = document.getElementById("splash-screen");
  const appContainer = document.getElementById("app-container");
  const dniScreen = document.getElementById("dni-screen");

  // Tiempo de pantalla de carga: 2 segundos
  const DURATION_MS = 2000;

  setTimeout(() => {
    if (splashScreen) splashScreen.classList.add("fade-out");
    if (appContainer) {
      appContainer.classList.remove("hidden");
      setTimeout(() => {
        appContainer.style.opacity = "1";
      }, 50);
    }
    setTimeout(() => {
      if (splashScreen) splashScreen.style.display = "none";
    }, 500);
  }, DURATION_MS);

  // 2. Elementos de la interfaz
  const btnVerDni = document.getElementById("btn-ver-dni");
  const btnBackHome = document.getElementById("btn-back-home");

  // Modales
  const biometricModal = document.getElementById("biometric-modal");
  const pinModal = document.getElementById("pin-modal");

  const bioSheetTitle = document.getElementById("bio-sheet-title");
  const bioSheetSubtitle = document.getElementById("bio-sheet-subtitle");
  const fpContainer = document.getElementById("fingerprint-container");
  const fpSensor = document.getElementById("fingerprint-sensor");
  const fpStatus = document.getElementById("fp-status");

  const faceidContainer = document.getElementById("faceid-container");
  const faceidSensor = document.getElementById("faceid-sensor");
  const faceidStatus = document.getElementById("faceid-status");
  const btnToggleBioMode = document.getElementById("btn-toggle-bio-mode");
  const bioModeText = document.getElementById("bio-mode-text");

  const btnUsePin = document.getElementById("btn-use-pin");
  const btnCancelBio = document.getElementById("btn-cancel-bio");
  const btnCancelPin = document.getElementById("btn-cancel-pin");

  // Detección iOS (iPhone / iPad) para predeterminar Face ID
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let currentBioMode = isIOS ? "faceid" : "fingerprint";

  // DNI Interactivo
  const btnToggleDni = document.getElementById("btn-toggle-dni");
  const dniNumberEl = document.getElementById("dni-number");
  const eyeIcon = document.getElementById("eye-icon");
  const btnMostrarQr = document.getElementById("btn-mostrar-qr");
  const dniFieldsScroll = document.getElementById("dni-fields-scroll");

  // Estado
  const REAL_DNI = "74541939C";
  const MASKED_DNI = "74••••9C";
  let isDniMasked = false;
  let pinEntered = "";
  let isAuthenticating = false;
  let qrTimerInterval = null;

  // Registro del Service Worker para funcionamiento Offline y PWA en iOS
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.log("ServiceWorker registration error:", err);
      });
    });
  }

  // ----------------------------------------------------
  // EVENTO: PULSAR "VER MI DNI"
  // ----------------------------------------------------
  if (btnVerDni) {
    btnVerDni.addEventListener("click", () => {
      playFeedbackTone(600, 0.04);
      triggerBiometricAuth();
    });
  }

  function triggerBiometricAuth() {
    // Si estamos en la app Android y tiene sensor nativo activo
    if (window.AndroidBiometric && typeof window.AndroidBiometric.authenticate === "function") {
      try {
        window.AndroidBiometric.authenticate();
        return;
      } catch (e) {
        console.warn("AndroidBiometric error, usando modal web:", e);
      }
    }

    // Si estamos en la app nativa iOS (WKWebView) y tiene handler configurado
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iOSBiometric) {
      try {
        window.webkit.messageHandlers.iOSBiometric.postMessage({ action: "authenticate" });
        return;
      } catch (e) {
        console.warn("iOSBiometric error, usando modal web:", e);
      }
    }

    // Modal biométrico realista integrado
    openBiometricSheet();
  }

  // ----------------------------------------------------
  // MODAL BIOMÉTRICO (HUELLA / FACE ID)
  // ----------------------------------------------------
  function updateBioModeUI() {
    if (currentBioMode === "faceid") {
      if (fpContainer) fpContainer.classList.add("hidden");
      if (faceidContainer) faceidContainer.classList.remove("hidden");
      if (bioSheetTitle) bioSheetTitle.textContent = "Face ID";
      if (bioSheetSubtitle) bioSheetSubtitle.textContent = "Mira a la pantalla para verificar tu identidad";
      if (bioModeText) bioModeText.textContent = "Cambiar a Huella dactilar";
    } else {
      if (faceidContainer) faceidContainer.classList.add("hidden");
      if (fpContainer) fpContainer.classList.remove("hidden");
      if (bioSheetTitle) bioSheetTitle.textContent = "Verificación de identidad";
      if (bioSheetSubtitle) bioSheetSubtitle.textContent = "Coloca tu huella en el sensor para acceder a tu DNI";
      if (bioModeText) bioModeText.textContent = "Cambiar a Face ID";
    }
  }

  function openBiometricSheet() {
    updateBioModeUI();
    resetBioUI();
    biometricModal.classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate(20);
  }

  function closeBiometricSheet() {
    biometricModal.classList.add("hidden");
    resetBioUI();
  }

  function resetBioUI() {
    isAuthenticating = false;
    if (fpSensor) {
      fpSensor.classList.remove("scanning", "success");
    }
    if (fpStatus) {
      fpStatus.classList.remove("success");
      fpStatus.textContent = "Toca el sensor de huella";
    }
    if (faceidSensor) {
      faceidSensor.classList.remove("scanning", "success");
    }
    if (faceidStatus) {
      faceidStatus.classList.remove("success");
      faceidStatus.textContent = "Toca para desbloquear con Face ID";
    }
  }

  // Alternador de método biométrico (Huella <-> Face ID)
  if (btnToggleBioMode) {
    btnToggleBioMode.addEventListener("click", () => {
      currentBioMode = currentBioMode === "faceid" ? "fingerprint" : "faceid";
      updateBioModeUI();
      resetBioUI();
      playFeedbackTone(600, 0.04);
    });
  }

  // Evento Sensor Huella Dactilar
  if (fpSensor) {
    const handleFpPress = (e) => {
      e.preventDefault();
      if (isAuthenticating) return;
      isAuthenticating = true;

      // 1. Inicio de escaneo
      fpSensor.classList.add("scanning");
      if (fpStatus) fpStatus.textContent = "Verificando huella...";
      if (navigator.vibrate) navigator.vibrate([25]);
      playFeedbackTone(520, 0.08);

      // 2. Simulación de lectura biométrica rápida y realista (650 ms)
      setTimeout(() => {
        fpSensor.classList.remove("scanning");
        fpSensor.classList.add("success");
        if (fpStatus) {
          fpStatus.classList.add("success");
          fpStatus.textContent = "Huella reconocida";
        }

        // Tono y vibración de confirmación oficial
        playSuccessTone();
        if (navigator.vibrate) navigator.vibrate([30, 40, 45]);

        // 3. Transición a la tarjeta del DNI
        setTimeout(() => {
          closeBiometricSheet();
          showDniScreen();
        }, 500);
      }, 700);
    };

    fpSensor.addEventListener("click", handleFpPress);
    fpSensor.addEventListener("touchstart", handleFpPress, { passive: false });
  }

  // Evento Sensor Face ID (iPhone / iOS)
  if (faceidSensor) {
    const handleFaceIdPress = (e) => {
      e.preventDefault();
      if (isAuthenticating) return;
      isAuthenticating = true;

      faceidSensor.classList.add("scanning");
      if (faceidStatus) faceidStatus.textContent = "Escaneando rostro...";
      if (navigator.vibrate) navigator.vibrate([20]);
      playFeedbackTone(520, 0.08);

      setTimeout(() => {
        faceidSensor.classList.remove("scanning");
        faceidSensor.classList.add("success");
        if (faceidStatus) {
          faceidStatus.classList.add("success");
          faceidStatus.textContent = "Rostro verificado";
        }

        playSuccessTone();
        if (navigator.vibrate) navigator.vibrate([30, 40, 45]);

        setTimeout(() => {
          closeBiometricSheet();
          showDniScreen();
        }, 500);
      }, 700);
    };

    faceidSensor.addEventListener("click", handleFaceIdPress);
    faceidSensor.addEventListener("touchstart", handleFaceIdPress, { passive: false });
  }

  if (btnCancelBio) {
    btnCancelBio.addEventListener("click", closeBiometricSheet);
  }

  if (btnUsePin) {
    btnUsePin.addEventListener("click", () => {
      closeBiometricSheet();
      openPinModal();
    });
  }

  // ----------------------------------------------------
  // MODAL PIN NUMÉRICO (FALLBACK)
  // ----------------------------------------------------
  function openPinModal() {
    pinEntered = "";
    updatePinDots();
    pinModal.classList.remove("hidden");
  }

  function closePinModal() {
    pinModal.classList.add("hidden");
    pinEntered = "";
    updatePinDots();
  }

  if (btnCancelPin) {
    btnCancelPin.addEventListener("click", () => {
      closePinModal();
      openBiometricSheet();
    });
  }

  const keyButtons = document.querySelectorAll(".key-btn");
  keyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-key");
      const action = btn.getAttribute("data-action");

      if (key !== null) {
        if (pinEntered.length < 6) {
          pinEntered += key;
          playFeedbackTone(700 + pinEntered.length * 50, 0.03);
          if (navigator.vibrate) navigator.vibrate(12);
          updatePinDots();

          // Al completar 6 dígitos
          if (pinEntered.length === 6) {
            handlePinComplete();
          }
        }
      } else if (action === "backspace") {
        if (pinEntered.length > 0) {
          pinEntered = pinEntered.slice(0, -1);
          playFeedbackTone(450, 0.03);
          if (navigator.vibrate) navigator.vibrate(10);
          updatePinDots();
        }
      }
    });
  });

  function updatePinDots() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot, idx) => {
      if (idx < pinEntered.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled", "success");
      }
    });
  }

  function handlePinComplete() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot) => dot.classList.add("success"));
    playSuccessTone();
    if (navigator.vibrate) navigator.vibrate([30, 40, 45]);

    setTimeout(() => {
      closePinModal();
      showDniScreen();
    }, 400);
  }

  // ----------------------------------------------------
  // PANTALLA "VER MI DNI" Y TEMPORIZADOR DE 60 SEGUNDOS
  // ----------------------------------------------------
  const dniTimerText = document.getElementById("dni-timer-text");
  let dniExpiryInterval = null;
  let dniSecondsLeft = 60;

  function startDniExpiryTimer() {
    stopDniExpiryTimer();
    dniSecondsLeft = 60;
    updateDniTimerDisplay();

    dniExpiryInterval = setInterval(() => {
      dniSecondsLeft--;
      updateDniTimerDisplay();

      if (dniSecondsLeft <= 0) {
        stopDniExpiryTimer();
        hideDniScreen(); // Salir automáticamente al agotarse los 60 segundos
      }
    }, 1000);
  }

  function stopDniExpiryTimer() {
    if (dniExpiryInterval) {
      clearInterval(dniExpiryInterval);
      dniExpiryInterval = null;
    }
  }

  function updateDniTimerDisplay() {
    if (dniTimerText) {
      dniTimerText.textContent = `Información visible ${dniSecondsLeft} segundos`;
    }
  }

  function showDniScreen() {
    if (!dniScreen) return;
    dniScreen.classList.remove("hidden");
    if (dniFieldsScroll) {
      dniFieldsScroll.scrollTop = 0;
    }
    startDniExpiryTimer(); // Iniciar cuenta atrás de 60s
    setTimeout(() => {
      dniScreen.style.transform = "translateX(0)";
      dniScreen.style.opacity = "1";
    }, 20);
  }

  function hideDniScreen() {
    if (!dniScreen) return;
    stopDniExpiryTimer(); // Detener el temporizador
    if (typeof hideQrDisplayScreen === "function") hideQrDisplayScreen();
    if (typeof hideQrOptionsScreen === "function") hideQrOptionsScreen();
    dniScreen.style.transform = "translateX(100%)";
    dniScreen.style.opacity = "0";
    setTimeout(() => {
      dniScreen.classList.add("hidden");
    }, 320);
  }

  if (btnBackHome) {
    btnBackHome.addEventListener("click", () => {
      playFeedbackTone(400, 0.03);
      hideDniScreen();
    });
  }

  // Alternar máscara del DNI
  if (btnToggleDni && dniNumberEl) {
    btnToggleDni.addEventListener("click", () => {
      isDniMasked = !isDniMasked;
      dniNumberEl.textContent = isDniMasked ? MASKED_DNI : REAL_DNI;
      if (isDniMasked) {
        eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
      } else {
        eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
      }
      if (navigator.vibrate) navigator.vibrate(15);
    });
  }

  // ----------------------------------------------------
  // ----------------------------------------------------
  // GESTIÓN ROBUSTA DE TOQUES / CLICKS (MÓVIL ANDROID)
  // ----------------------------------------------------
  function attachTapOrClick(el, handler) {
    if (!el) return;
    let touchHandled = false;
    el.addEventListener("touchend", (e) => {
      touchHandled = true;
      e.preventDefault();
      handler(e);
      setTimeout(() => { touchHandled = false; }, 300);
    }, { passive: false });
    el.addEventListener("click", (e) => {
      if (touchHandled) return;
      handler(e);
    });
  }

  // ----------------------------------------------------
  // PANTALLA "MOSTRAR TU DNI" (ELECCIÓN DE DATOS PARA QR)
  // ----------------------------------------------------
  const qrOptionsScreen = document.getElementById("qr-options-screen");
  const btnBackQrOptions = document.getElementById("btn-back-qr-options");
  const btnOptDniEdad = document.getElementById("btn-opt-dni-edad");
  const btnOptDniSimple = document.getElementById("btn-opt-dni-simple");
  const btnOptDniCompleto = document.getElementById("btn-opt-dni-completo");

  function showQrOptionsScreen() {
    const el = qrOptionsScreen || document.getElementById("qr-options-screen");
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = "flex";
    requestAnimationFrame(() => {
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      el.classList.add("visible");
    });
  }

  function hideQrOptionsScreen() {
    const el = qrOptionsScreen || document.getElementById("qr-options-screen");
    if (!el) return;
    el.style.transform = "translateX(100%)";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.classList.remove("visible");
    setTimeout(() => {
      el.style.display = "none";
      el.classList.add("hidden");
    }, 280);
  }

  // ----------------------------------------------------
  // PANTALLA COMPLETA DE CÓDIGO QR OFICIAL (DNI EDAD / SIMPLE / COMPLETO)
  // ----------------------------------------------------
  const qrDisplayScreen = document.getElementById("qr-display-screen");
  const btnCloseQr = document.getElementById("btn-close-qr");
  const qrScreenModeTitle = document.getElementById("qr-screen-mode-title");
  const qrDisplayDesc = document.getElementById("qr-display-desc");
  const qrCodeImg = document.getElementById("qr-code-img");
  const dniQrCanvas = document.getElementById("dni-qr-canvas");
  const qrTimerText = document.getElementById("qr-timer-text");

  function openCustomQrScreen(mode) {
    playFeedbackTone(600, 0.05);
    if (navigator.vibrate) navigator.vibrate(25);

    const titleEl = qrScreenModeTitle || document.getElementById("qr-screen-mode-title");
    const descEl = qrDisplayDesc || document.getElementById("qr-display-desc");
    const codeImg = qrCodeImg || document.getElementById("qr-code-img");
    const qrCanvas = dniQrCanvas || document.getElementById("dni-qr-canvas");
    const displayScreen = qrDisplayScreen || document.getElementById("qr-display-screen");

    if (mode === "edad") {
      if (titleEl) titleEl.textContent = "EDAD";
      if (descEl) {
        descEl.textContent = "Compartirás tu foto, DNI y si eres mayor de edad.";
      }
      if (codeImg) {
        codeImg.src = "qr_edad_exact.png";
        codeImg.style.display = "block";
      }
      if (qrCanvas) {
        qrCanvas.style.display = "none";
      }
    } else if (mode === "simple") {
      if (titleEl) titleEl.textContent = "SIMPLE";
      if (descEl) {
        descEl.textContent = "Compartirás tu foto, DNI, nombre, apellidos, fecha de nacimiento, sexo y fecha de validez del DNI.";
      }
      renderDenseOfficialQr(mode);
      if (codeImg) codeImg.style.display = "none";
      if (qrCanvas) qrCanvas.style.display = "block";
    } else {
      if (titleEl) titleEl.textContent = "COMPLETO";
      if (descEl) {
        descEl.textContent = "Compartirás todos los datos de tu DNI.";
      }
      renderDenseOfficialQr(mode);
      if (codeImg) codeImg.style.display = "none";
      if (qrCanvas) qrCanvas.style.display = "block";
    }

    startQrTimer60();

    if (displayScreen) {
      displayScreen.classList.remove("hidden");
      displayScreen.style.display = "flex";
      requestAnimationFrame(() => {
        displayScreen.style.transform = "translateX(0)";
        displayScreen.style.opacity = "1";
        displayScreen.style.pointerEvents = "auto";
        displayScreen.classList.add("visible");
      });
    }
  }

  function hideQrDisplayScreen() {
    const displayScreen = qrDisplayScreen || document.getElementById("qr-display-screen");
    if (!displayScreen) return;
    displayScreen.style.transform = "translateX(100%)";
    displayScreen.style.opacity = "0";
    displayScreen.style.pointerEvents = "none";
    displayScreen.classList.remove("visible");
    if (qrTimerInterval) {
      clearInterval(qrTimerInterval);
      qrTimerInterval = null;
    }
    setTimeout(() => {
      displayScreen.style.display = "none";
      displayScreen.classList.add("hidden");
    }, 280);
  }

  // Exponer a window para llamada inmediata desde HTML inline onclick
  window.showQrOptionsScreen = () => {
    playFeedbackTone(550, 0.05);
    showQrOptionsScreen();
  };
  window.hideQrOptionsScreen = () => {
    playFeedbackTone(400, 0.03);
    hideQrOptionsScreen();
  };
  window.openCustomQrScreen = (mode) => {
    openCustomQrScreen(mode);
  };
  window.hideQrDisplayScreen = () => {
    playFeedbackTone(400, 0.03);
    hideQrDisplayScreen();
  };

  // Enlazar eventos de toque y click para máxima respuesta
  attachTapOrClick(btnMostrarQr, () => {
    playFeedbackTone(550, 0.05);
    showQrOptionsScreen();
  });

  attachTapOrClick(btnBackQrOptions, () => {
    playFeedbackTone(400, 0.03);
    hideQrOptionsScreen();
  });

  attachTapOrClick(btnOptDniEdad, () => openCustomQrScreen("edad"));
  attachTapOrClick(btnOptDniSimple, () => openCustomQrScreen("simple"));
  attachTapOrClick(btnOptDniCompleto, () => openCustomQrScreen("completo"));
  attachTapOrClick(btnCloseQr, () => {
    playFeedbackTone(400, 0.03);
    hideQrDisplayScreen();
  });

  // ========================================================
  // PANTALLA DE ESCÁNER / VERIFICADOR QR OFICIAL MIDNI
  // ========================================================
  const btnOpenScanner = document.getElementById("btn-open-scanner");
  const scannerScreen = document.getElementById("scanner-screen");
  const btnBackScanner = document.getElementById("btn-back-scanner");
  const btnScannerFlash = document.getElementById("btn-scanner-flash");
  const scannerVideo = document.getElementById("scanner-video");
  const scannerBox = document.getElementById("scanner-box");
  const btnTriggerScan = document.getElementById("btn-trigger-scan");

  // Modal de resultado
  const scanResultModal = document.getElementById("scan-result-modal");
  const btnCloseScanResult = document.getElementById("btn-close-scan-result");
  const btnScanAnother = document.getElementById("btn-scan-another");
  const scanResTimestamp = document.getElementById("scan-res-timestamp");

  let scannerStream = null;
  let isTorchOn = false;
  let qrScanInterval = null;
  let isScanProcessing = false;

  async function startScannerCamera() {
    stopScannerCamera();
    isScanProcessing = false;
    if (scannerBox) scannerBox.classList.remove("verified");

    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        scannerStream = stream;
        if (scannerVideo) {
          scannerVideo.srcObject = stream;
          scannerVideo.play().catch(() => { });
        }
        setupBarcodeDetector();
      } catch (e) {
        console.log("Cámara no disponible o permiso denegado, utilizando visor simulado:", e);
      }
    }
  }

  function stopScannerCamera() {
    if (qrScanInterval) {
      clearInterval(qrScanInterval);
      qrScanInterval = null;
    }
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop());
      scannerStream = null;
    }
    if (scannerVideo) {
      scannerVideo.srcObject = null;
    }
    isTorchOn = false;
    if (btnScannerFlash) btnScannerFlash.classList.remove("flash-active");
  }

  function setupBarcodeDetector() {
    if ("BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        qrScanInterval = setInterval(async () => {
          if (isScanProcessing || !scannerVideo || scannerVideo.readyState < 2) return;
          try {
            const barcodes = await detector.detect(scannerVideo);
            if (barcodes && barcodes.length > 0) {
              triggerVerifiedScan();
            }
          } catch (err) { }
        }, 300);
      } catch (err) { }
    }
  }

  function toggleScannerFlash() {
    if (!scannerStream) {
      isTorchOn = !isTorchOn;
      if (btnScannerFlash) btnScannerFlash.classList.toggle("flash-active", isTorchOn);
      return;
    }
    const track = scannerStream.getVideoTracks()[0];
    if (track) {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        isTorchOn = !isTorchOn;
        track.applyConstraints({ advanced: [{ torch: isTorchOn }] }).catch(() => { });
        if (btnScannerFlash) btnScannerFlash.classList.toggle("flash-active", isTorchOn);
      } else {
        isTorchOn = !isTorchOn;
        if (btnScannerFlash) btnScannerFlash.classList.toggle("flash-active", isTorchOn);
      }
    }
  }

  function showScannerScreen() {
    const el = scannerScreen || document.getElementById("scanner-screen");
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = "flex";
    requestAnimationFrame(() => {
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      el.classList.add("visible");
    });
    startScannerCamera();
  }

  function hideScannerScreen() {
    stopScannerCamera();
    const el = scannerScreen || document.getElementById("scanner-screen");
    if (!el) return;
    el.style.transform = "translateX(100%)";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.classList.remove("visible");
    setTimeout(() => {
      el.style.display = "none";
      el.classList.add("hidden");
    }, 280);
  }

  function triggerVerifiedScan() {
    if (isScanProcessing) return;
    isScanProcessing = true;

    // Feedback audiovisual de lectura correcta
    if (scannerBox) scannerBox.classList.add("verified");
    playSuccessTone();
    if (navigator.vibrate) navigator.vibrate([40, 60, 50]);

    setTimeout(() => {
      showScanResult();
    }, 600);
  }

  function showScanResult() {
    const modal = scanResultModal || document.getElementById("scan-result-modal");
    if (!modal) return;

    // Actualizar fecha y hora en tiempo real
    if (scanResTimestamp) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const d = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      scanResTimestamp.textContent = `${d} ${t}`;
    }

    modal.classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate([30, 40]);
  }

  function hideScanResult() {
    const modal = scanResultModal || document.getElementById("scan-result-modal");
    if (modal) modal.classList.add("hidden");
    hideScannerScreen();
  }

  function rescanQr() {
    const modal = scanResultModal || document.getElementById("scan-result-modal");
    if (modal) modal.classList.add("hidden");
    if (scannerBox) scannerBox.classList.remove("verified");
    isScanProcessing = false;
  }

  // Exponer a window para llamadas inline y MainActivity
  window.showScannerScreen = () => {
    playFeedbackTone(500, 0.04);
    showScannerScreen();
  };
  window.hideScannerScreen = () => {
    playFeedbackTone(400, 0.03);
    hideScannerScreen();
  };
  window.onScannerOpened = startScannerCamera;
  window.onScannerClosed = stopScannerCamera;
  window.toggleScannerFlash = () => {
    playFeedbackTone(600, 0.03);
    toggleScannerFlash();
  };
  window.triggerSimulatedScan = triggerVerifiedScan;
  window.showScanResult = showScanResult;
  window.hideScanResult = hideScanResult;
  window.rescanQr = rescanQr;

  // Registrar eventos táctiles y de click
  attachTapOrClick(btnOpenScanner, () => {
    playFeedbackTone(500, 0.04);
    showScannerScreen();
  });
  attachTapOrClick(btnBackScanner, () => {
    playFeedbackTone(400, 0.03);
    hideScannerScreen();
  });
  attachTapOrClick(scannerBox, () => {
    triggerVerifiedScan();
  });
  attachTapOrClick(btnScannerFlash, toggleScannerFlash);
  attachTapOrClick(btnTriggerScan, triggerVerifiedScan);
  attachTapOrClick(btnCloseScanResult, hideScanResult);
  attachTapOrClick(btnScanAnother, rescanQr);

  function startQrTimer60() {
    if (qrTimerInterval) clearInterval(qrTimerInterval);
    let secondsLeft = 60;

    const updateTimer = () => {
      if (qrTimerText) {
        qrTimerText.textContent = `QR visible ${secondsLeft} segundos`;
      }
      if (secondsLeft <= 0) {
        clearInterval(qrTimerInterval);
        qrTimerInterval = null;
        hideQrDisplayScreen();
        return;
      }
      secondsLeft--;
    };

    updateTimer();
    qrTimerInterval = setInterval(updateTimer, 1000);
  }

  function renderDenseOfficialQr(mode = "completo") {
    const canvas = document.getElementById("dni-qr-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = canvas.width; // 388
    const cells = 65; // Cuadrícula de alta densidad idéntica al QR oficial del DNI
    const cellSize = size / cells;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Patrón de posición (7x7 exterior, 5x5 blanco, 3x3 interior negro)
    const drawFinder = (cx, cy) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(cx * cellSize, cy * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((cx + 1) * cellSize, (cy + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect((cx + 2) * cellSize, (cy + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    // Patrón de alineación (5x5 exterior, 3x3 blanco, 1x1 interior negro)
    const drawAlignment = (cx, cy) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect((cx - 2) * cellSize, (cy - 2) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((cx - 1) * cellSize, (cy - 1) * cellSize, 3 * cellSize, 3 * cellSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect(cx * cellSize, cy * cellSize, 1 * cellSize, 1 * cellSize);
    };

    // 3 marcadores QR en esquinas
    drawFinder(0, 0);
    drawFinder(cells - 7, 0);
    drawFinder(0, cells - 7);

    // Líneas de sincronización (timing patterns)
    for (let i = 8; i < cells - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(i * cellSize, 6 * cellSize, cellSize, cellSize);
        ctx.fillRect(6 * cellSize, i * cellSize, cellSize, cellSize);
      }
    }

    // Patrones de alineación
    const alignCoords = [
      [28, 28], [28, 50],
      [50, 28], [50, 50]
    ];
    for (const [ax, ay] of alignCoords) {
      drawAlignment(ax, ay);
    }

    // Distribución densa de datos DNI
    let seed = mode === "simple" ? 74921 : 92837;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    ctx.fillStyle = "#000000";
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        // Excluir marcadores y sus separadores
        const inFinder1 = x <= 7 && y <= 7;
        const inFinder2 = x >= cells - 8 && y <= 7;
        const inFinder3 = x <= 7 && y >= cells - 8;
        // Excluir líneas de sincronización
        const onTiming = (y === 6 && x >= 8 && x < cells - 8) || (x === 6 && y >= 8 && y < cells - 8);
        // Excluir patrones de alineación
        let inAlign = false;
        for (const [ax, ay] of alignCoords) {
          if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) {
            inAlign = true;
            break;
          }
        }

        if (!inFinder1 && !inFinder2 && !inFinder3 && !onTiming && !inAlign) {
          if (rand() > 0.48) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize + 0.1, cellSize + 0.1);
          }
        }
      }
    }
  }

  // ----------------------------------------------------
  // GANCHOS PARA LA INTEGRACIÓN NATIVA ANDROID
  // ----------------------------------------------------
  window.onAndroidBiometricSuccess = () => {
    closeBiometricSheet();
    closePinModal();
    playSuccessTone();
    if (navigator.vibrate) navigator.vibrate([30, 40, 45]);
    showDniScreen();
  };

  window.onAndroidBiometricFallback = () => {
    // Si el móvil no tiene huella registrada o hay error de hardware, abrir modal web
    openBiometricSheet();
  };

  window.onAndroidBiometricCancel = () => {
    // Cancelado por el usuario, no hacer nada
  };

  window.onAndroidBiometricError = () => {
    openPinModal();
  };

  // Puentes para app nativa iOS (Face ID / Touch ID)
  window.onIOSBiometricSuccess = () => {
    closeBiometricSheet();
    closePinModal();
    playSuccessTone();
    if (navigator.vibrate) navigator.vibrate([30, 40, 45]);
    showDniScreen();
  };

  window.onIOSBiometricFallback = () => {
    openBiometricSheet();
  };

  window.onIOSBiometricCancel = () => { };

  window.onIOSBiometricError = () => {
    openPinModal();
  };

  // ----------------------------------------------------
  // CONTROLADOR DEL MENÚ LATERAL DESPLEGABLE (DRAWER MIDNI)
  // ----------------------------------------------------
  const sideDrawerBackdrop = document.getElementById("side-drawer-backdrop");
  const sideDrawer = document.getElementById("side-drawer");
  const btnOpenMenu = document.getElementById("btn-open-menu");
  const btnCloseDrawer = document.getElementById("btn-close-drawer");

  const drawerInfoModal = document.getElementById("drawer-info-modal");
  const drawerInfoTitle = document.getElementById("drawer-info-title");
  const drawerInfoBody = document.getElementById("drawer-info-body");

  function openSideDrawer() {
    playFeedbackTone(550, 0.04);
    if (navigator.vibrate) navigator.vibrate(20);
    if (sideDrawerBackdrop) sideDrawerBackdrop.classList.remove("hidden");
    if (sideDrawer) {
      sideDrawer.classList.remove("hidden");
      sideDrawer.setAttribute("aria-hidden", "false");
    }
  }

  function closeSideDrawer() {
    if (sideDrawer) {
      sideDrawer.classList.add("hidden");
      sideDrawer.setAttribute("aria-hidden", "true");
    }
    if (sideDrawerBackdrop) sideDrawerBackdrop.classList.add("hidden");
  }

  function drawerGoToDni() {
    closeSideDrawer();
    setTimeout(() => {
      triggerBiometricAuth();
    }, 180);
  }

  function drawerGoToScanner() {
    closeSideDrawer();
    setTimeout(() => {
      showScannerScreen();
    }, 180);
  }

  function openDrawerInfoModal(type) {
    if (!drawerInfoModal || !drawerInfoTitle || !drawerInfoBody) return;
    playFeedbackTone(520, 0.04);
    if (navigator.vibrate) navigator.vibrate(25);

    if (type === "ajustes") {
      drawerInfoTitle.textContent = "Ajustes y Seguridad";
      drawerInfoBody.innerHTML = `
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Biometría (Huella / Rostro)</span>
          <span class="drawer-info-row-val">Activada</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">PIN de acceso</span>
          <span class="drawer-info-row-val">6 dígitos</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Bloqueo automático</span>
          <span class="drawer-info-row-val">Inmediato</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Dispositivo</span>
          <span class="drawer-info-row-val">Vinculado (PAD)</span>
        </div>
      `;
    } else if (type === "ayuda") {
      drawerInfoTitle.textContent = "Ayuda y Preguntas frecuentes";
      drawerInfoBody.innerHTML = `
        <p><strong>¿Qué es MiDNI?</strong><br>Es la aplicación oficial de la Policía Nacional para portar y acreditar tu identidad digital con plena validez legal en España.</p>
        <p><strong>Tipos de código QR:</strong><br>
        • <strong>DNI edad:</strong> Acredita si eres mayor de edad (+18) protegiendo el resto de tus datos.<br>
        • <strong>DNI simple:</strong> Comparte datos básicos para gestiones y registros habituales.<br>
        • <strong>DNI completo:</strong> Comparte todos los datos de tu documento oficial.</p>
        <p><strong>Seguridad:</strong> Los códigos QR son dinámicos y caducan automáticamente a los 60 segundos.</p>
      `;
    } else if (type === "privacidad") {
      drawerInfoTitle.textContent = "Términos y Privacidad";
      drawerInfoBody.innerHTML = `
        <p><strong>Titular del servicio:</strong><br>Dirección General de la Policía (DGP) - Ministerio del Interior.</p>
        <p><strong>Protección de datos:</strong><br>El tratamiento de los datos cumple estrictamente con el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica 4/2015.</p>
        <p><strong>Almacenamiento seguro:</strong><br>No se almacenan copias ni datos biométricos en servidores externos. Toda la custodia se realiza en el chip seguro del terminal.</p>
      `;
    } else if (type === "acerca") {
      drawerInfoTitle.textContent = "Acerca de MiDNI";
      drawerInfoBody.innerHTML = `
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Aplicación</span>
          <span class="drawer-info-row-val">MiDNI Oficial</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Versión</span>
          <span class="drawer-info-row-val">2.6 (99999999)</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Organismo</span>
          <span class="drawer-info-row-val">Policía Nacional</span>
        </div>
        <div class="drawer-info-row">
          <span class="drawer-info-row-label">Estado</span>
          <span class="drawer-info-row-val" style="color: #10b981;">Certificado activo</span>
        </div>
      `;
    }

    drawerInfoModal.classList.remove("hidden");
  }

  function closeDrawerInfoModal() {
    if (drawerInfoModal) drawerInfoModal.classList.add("hidden");
  }

  // Exponer a window
  window.openSideDrawer = openSideDrawer;
  window.closeSideDrawer = closeSideDrawer;
  window.drawerGoToDni = drawerGoToDni;
  window.drawerGoToScanner = drawerGoToScanner;
  window.openDrawerInfoModal = openDrawerInfoModal;
  window.closeDrawerInfoModal = closeDrawerInfoModal;

  attachTapOrClick(btnOpenMenu, openSideDrawer);
  attachTapOrClick(btnCloseDrawer, closeSideDrawer);
});

// ========================================================
// SÍNTESIS DE AUDIO REALISTA (WEB AUDIO API)
// ========================================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playFeedbackTone(freq, dur) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (e) { }
}

function playSuccessTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  } catch (e) { }
}

// ========================================================
// ONDA VIAJERA DE LAS LÍNEAS DE SEGURIDAD
// ========================================================
function initWavesAnimation(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const IMG_W = 1024;
  const IMG_H = 1024;
  const SLICE = 1;
  const PERIOD_PX = 610;
  const CYCLE_S = 6.5;
  const SPLIT_X = 336;

  const blocks = [
    { from: 0, to: SPLIT_X, A: 40, xValley: 30 },
    { from: SPLIT_X, to: IMG_W, A: 31, xValley: 675 },
  ];

  canvas.width = IMG_W;
  canvas.height = IMG_H;

  const img = new Image();
  img.src = "fondo_ondas.png";

  function frame(now) {
    const phase = ((now / 1000) / CYCLE_S) * Math.PI * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const b of blocks) {
      for (let x = b.from; x < b.to; x += SLICE) {
        const w = Math.min(SLICE, b.to - x);
        const theta = (2 * Math.PI * (x + w / 2 - b.xValley)) / PERIOD_PX;
        const dy = b.A * (Math.cos(theta + phase) - Math.cos(theta));
        ctx.drawImage(img, x, 0, w, IMG_H, x, dy, w, IMG_H);
      }
    }
    requestAnimationFrame(frame);
  }

  if (img.complete && img.naturalWidth > 0) {
    requestAnimationFrame(frame);
  } else {
    img.onload = () => requestAnimationFrame(frame);
  }
}
