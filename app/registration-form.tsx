'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

type RegistrationFormProps = {
  onSubmit: (name: string, phone: string) => Promise<void>;
};

export default function RegistrationForm({ onSubmit }: RegistrationFormProps) {
  const [name, setName] = useState('');
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!/^[0-9]{8}$/.test(phoneSuffix)) {
      setError('010 뒤에 휴대전화번호 8자리를 입력해주세요.');
      return;
    }

    setError('');
    if (!window.confirm(`입력하신 정보가 맞나요?\n\n이름: ${trimmedName}\n휴대전화번호: 010-${phoneSuffix.slice(0, 4)}-${phoneSuffix.slice(4)}\n\n응모권 발급과 경품 추첨에 사용됩니다. 본인 번호인지 다시 확인해주세요.`)) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmedName, `010${phoneSuffix}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그인하지 못했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate>
      <p className="registration-help">경품 추첨과 응모권 발급에 사용할 정보입니다. 이름과 휴대전화번호를 정확히 입력해주세요.</p>
      <label htmlFor="registration-name">이름</label>
      <input
        id="registration-name"
        name="name"
        type="text"
        autoComplete="name"
        maxLength={50}
        placeholder="이름을 입력해주세요"
        value={name}
        onChange={event => setName(event.target.value)}
        disabled={submitting}
        required
      />
      <label htmlFor="registration-phone">휴대전화번호</label>
      <div className="registration-phone">
        <span aria-hidden="true">010</span>
        <input
          id="registration-phone"
          name="phone-suffix"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          pattern="[0-9]{4}-[0-9]{4}"
          placeholder="0000-0000"
          aria-label="010 뒤 휴대전화번호 8자리"
          value={phoneSuffix.length > 4 ? `${phoneSuffix.slice(0, 4)}-${phoneSuffix.slice(4)}` : phoneSuffix}
          onChange={event => setPhoneSuffix(event.target.value.replace(/\D/g, '').slice(0, 8))}
          disabled={submitting}
          required
        />
      </div>
      {error && <p className="registration-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? '확인 중...' : '로그인하고 시작하기'}<ArrowRight size={20} />
      </button>
    </form>
  );
}
