import React, { useEffect, useRef } from "react";
import { Camera, Mic, Send, X } from "lucide-react";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  isListening: boolean;
  voiceSupported: boolean;
  isLoading: boolean;
  placeholder: string;
  onImageSelected: (file?: File) => void;
  imagePreview?: string;
};

export function ChatComposer({ value, onChange, onSend, onVoice, isListening, voiceSupported, isLoading, placeholder, onImageSelected, imagePreview }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [value]);

  return (
    <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <input ref={imageInputRef} className="chat-image-input" type="file" accept="image/*" capture="environment" aria-label="التقاط صورة أو اختيار صورة" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onImageSelected(file); event.currentTarget.value = ""; }} />
      <button type="button" className="chat-camera-button" onClick={() => imageInputRef.current?.click()} disabled={isLoading} aria-label="التقاط صورة أو إرفاق صورة" title="التقط صورة أو اختر صورة لتحليلها">
        <Camera size={19} />
      </button>
      <button
        type="button"
        className={isListening ? "listening" : ""}
        onClick={onVoice}
        aria-label="voice"
        disabled={!voiceSupported || isLoading}
        title={!voiceSupported ? "التعرف الصوتي غير متاح في هذا المتصفح" : isListening ? "إيقاف الاستماع" : "تحدث بالعربية"}
      >
        <Mic size={17} />
      </button>
      <div className="chat-compose-field">
        {imagePreview && <div className="chat-image-preview"><img src={imagePreview} alt="الصورة المرفقة للمساعد" /><button type="button" onClick={() => onImageSelected(undefined)} aria-label="إزالة الصورة" title="إزالة الصورة"><X size={15} /></button><small>ستُرسل الصورة للعسول لتحليلها</small></div>}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={isListening ? "أستمع الآن… تحدث بالعربية" : placeholder}
          aria-label="سؤال المساعد"
          rows={1}
          maxLength={4000}
        />
        <small>{value.length ? `${value.length}/4000` : "Enter للإرسال · Shift+Enter لسطر جديد"}</small>
      </div>
      <button type="submit" className="send-button" aria-label="إرسال" disabled={isLoading || (!value.trim() && !imagePreview)} title="إرسال السؤال أو الصورة">
        <Send size={16} />
      </button>
    </form>
  );
}
