<?php
/**
 * Mot de passe oublié
 * Fichier : pages/forgot-password.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

$page_title = 'Mot de passe oublié';

require_once '../includes/header.php';
?>

<section class="section">
    <div class="container" style="max-width: 520px;">
        <div class="section-title">
            <h2>Mot de passe oublié</h2>
            <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
        </div>

        <form id="forgotPasswordForm">
            <div class="form-group">
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required autocomplete="email">
            </div>

            <div class="form-error" id="formError"></div>
            <div class="form-success" id="formSuccess"></div>

            <button type="submit" class="btn btn-primary btn-full">Envoyer le lien</button>
        </form>
    </div>
</section>

<script>
document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formError = document.getElementById('formError');
    const formSuccess = document.getElementById('formSuccess');
    formError.textContent = '';
    formSuccess.textContent = '';

    const email = document.getElementById('email').value.trim();
    if (!email) {
        formError.textContent = 'Veuillez saisir votre email.';
        return;
    }

    try {
        const apiBaseUrl = <?php echo json_encode(getApiBaseUrl()); ?>;
        const response = await fetch(`${apiBaseUrl}/users/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors de l\'envoi');
        }
        formSuccess.textContent = data.message || 'Si un compte existe, un email a été envoyé.';
    } catch (error) {
        formError.textContent = error.message;
    }
});
</script>

<?php require_once '../includes/footer.php'; ?>
