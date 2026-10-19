import { useState } from "react";
import type { FormEvent } from "react";

interface LandingPageProps {
    onStart: (nickname: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
    const [nickname, setNickname] = useState("");
    const [showError, setShowError] = useState(false);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedNickname = nickname.trim();

        if (!trimmedNickname) {
            setShowError(true);
            return;
        }

        onStart(trimmedNickname);
    };

    return (
        <main className="landing-page">
            <section className="landing-card" aria-labelledby="landing-title">
                <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                <h1 id="landing-title">Talk to someone new.</h1>
                <p className="landing-copy">
                    Choose a nickname to enter the room.
                </p>

                <form onSubmit={handleSubmit} className="nickname-form">
                    <label htmlFor="nickname">Nickname</label>
                    <input
                        id="nickname"
                        name="nickname"
                        type="text"
                        value={nickname}
                        onChange={(event) => {
                            setNickname(event.target.value);
                            setShowError(false);
                        }}
                        placeholder="Enter your nickname"
                        autoComplete="nickname"
                        autoFocus
                        aria-invalid={showError}
                        aria-describedby={showError ? "nickname-error" : undefined}
                    />
                    {showError && (
                        <p id="nickname-error" className="form-error" role="alert">
                            Please enter a nickname to continue.
                        </p>
                    )}
                    <button type="submit" className="primary-button">
                        Start
                    </button>
                </form>
            </section>
        </main>
    );
}
