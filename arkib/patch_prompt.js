    window.showPromptDialog = function({ title = "Input Required", message = "Please enter a value:", placeholder = "", defaultValue = "", confirmText = "Submit", cancelText = "Cancel", icon = "✏️" } = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById("hubPromptModal");
            if (!modal) {
                const modalHtml = `
                    <div id="hubPromptModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); z-index: 100000; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: var(--surface-card, var(--bg-elevated, #18181b)); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border, rgba(255,255,255,0.1)); overflow: hidden; display: flex; flex-direction: column; font-family: var(--app-font-family, inherit);">
                            <div style="padding: 18px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; align-items: center; gap: 12px; background: var(--surface-hover, transparent);">
                                <div id="hubPromptIconBadge" style="width: 38px; height: 38px; border-radius: 10px; background: rgba(59, 130, 246, 0.12); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.25);">
                                    <span id="hubPromptIcon">✏️</span>
                                </div>
                                <div style="flex: 1;">
                                    <h3 id="hubPromptTitle" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--fg, #ffffff);">Input Required</h3>
                                </div>
                                <button type="button" id="hubPromptCloseX" style="background: none; border: none; color: var(--fg-muted, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
                            </div>
                            <div style="padding: 20px 22px; font-size: 13px; color: var(--fg-subtle, var(--fg, #ffffff)); line-height: 1.6;">
                                <div id="hubPromptMessage" style="margin-bottom: 12px;">Please enter a value:</div>
                                <input type="text" id="hubPromptInput" style="width: 100%; padding: 10px 14px; background: var(--bg, #09090b); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 8px; color: var(--fg, #ffffff); font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s;" />
                            </div>
                            <div style="padding: 14px 22px; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-hover, transparent);">
                                <button type="button" id="hubPromptCancelBtn" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; border: 1px solid var(--border, rgba(255,255,255,0.1)); color: var(--fg, #ffffff); transition: background 0.2s;">Cancel</button>
                                <button type="button" id="hubPromptOkBtn" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #3b82f6; color: #ffffff; transition: opacity 0.2s;">Submit</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                modal = document.getElementById("hubPromptModal");
                
                const style = document.createElement("style");
                style.innerHTML = `
                    #hubPromptCancelBtn:hover { background: var(--surface-active, rgba(255,255,255,0.05)) !important; }
                    #hubPromptOkBtn:hover { opacity: 0.9; }
                    #hubPromptInput:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important; }
                `;
                document.head.appendChild(style);
            }

            document.getElementById("hubPromptTitle").innerText = title;
            document.getElementById("hubPromptMessage").innerHTML = message.replace(/\n/g, '<br>');
            document.getElementById("hubPromptIcon").innerText = icon;
            document.getElementById("hubPromptCancelBtn").innerText = cancelText;
            document.getElementById("hubPromptOkBtn").innerText = confirmText;
            
            const inputField = document.getElementById("hubPromptInput");
            inputField.placeholder = placeholder;
            inputField.value = defaultValue;

            modal.style.display = "flex";
            modal.style.opacity = "0";
            modal.style.transform = "scale(0.98)";
            modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            
            requestAnimationFrame(() => {
                modal.style.opacity = "1";
                modal.style.transform = "scale(1)";
                inputField.focus();
            });

            const btnOk = document.getElementById("hubPromptOkBtn");
            const btnCancel = document.getElementById("hubPromptCancelBtn");
            const btnX = document.getElementById("hubPromptCloseX");

            const cleanup = () => {
                modal.style.opacity = "0";
                modal.style.transform = "scale(0.98)";
                setTimeout(() => {
                    modal.style.display = "none";
                }, 200);
            };

            const submitValue = () => {
                cleanup();
                resolve(inputField.value);
            };

            btnOk.onclick = submitValue;
            
            inputField.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitValue();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    cleanup();
                    resolve(null);
                }
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(null);
            };

            if (btnX) {
                btnX.onclick = () => {
                    cleanup();
                    resolve(null);
                };
            }

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            };
        });
    };
