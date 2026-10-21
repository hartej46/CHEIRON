import { useState } from "react";
import type { FormEvent } from "react";
import { initPlayer } from "../service/service";

interface LandingPageProps {
    onStart: (nickname: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
    const [nickname, setNickname] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedNickname = nickname.trim();

        if (!trimmedNickname) {
            setValidationError("Please enter a username to continue.");
            return;
        }

        if (trimmedNickname.length <= 2) {
            setValidationError("Username must be greater than 2 characters.");
            return;
        }

        try {
            setIsSubmitting(true);
            setApiError(null);
            setValidationError(null);
            await initPlayer(trimmedNickname);
            onStart(trimmedNickname);
        } catch (error) {
            setApiError(
                error instanceof Error ? error.message : "Unable to connect to server."
            );
        } finally {
            setIsSubmitting(false);
        }
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
                            setValidationError(null);
                            setApiError(null);
                        }}
                        placeholder="Enter your nickname"
                        autoComplete="nickname"
                        autoFocus
                        aria-invalid={Boolean(validationError)}
                        aria-describedby={
                            validationError
                                ? "nickname-error"
                                : apiError
                                  ? "nickname-api-error"
                                  : undefined
                        }
                    />
                    {validationError && (
                        <p id="nickname-error" className="form-error" role="alert">
                            {validationError}
                        </p>
                    )}
                    {apiError && (
                        <p id="nickname-api-error" className="form-error" role="alert">
                            {apiError}
                        </p>
                    )}
                    <button type="submit" className="primary-button" disabled={isSubmitting}>
                        {isSubmitting ? "Starting..." : "Start"}
                    </button>
                </form>
            </section>
        </main>
    );
}
