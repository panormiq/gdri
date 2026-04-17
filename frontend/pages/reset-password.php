<?php
/**
 * Réinitialisation du mot de passe
 * Fichier : pages/reset-password.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

$page_title = 'Réinitialisation du mot de passe';
$token = $_GET['token'] ?? '';

require_once '../includes/header.php';
?>

<section class="section">
    <div class="container" style="max-width: 520px;">
        <div class="section-title">
            <h2>Réinitialiser le mot de passe</h2>
            <p>Définissez un nouveau mot de passe pour votre compte.</p>
        </div>

        <form id="resetPasswordForm">
            <div class="form-group">
                <label for="token">Token *</label>
                <input type="text" id="token" name="token" required value="<?php echo htmlspecialchars($token); ?>">
            </div>

            <div class="form-group">
                <label for="password">Nouveau mot de passe *</label>
                <input type="password" id="password" name="password" required minlength="8">
                <small style="color: #666;">8 caractères minimum</small>
            </div>

            <div class="form-group">
                <label for="passwordConfirm">Confirmation *</label>
                <input type="password" id="passwordConfirm" name="passwordConfirm" required minlength="8">
            </div>

            <div class="form-error" id="formError"></div>
            <div class="form-success" id="formSuccess"></div>

            <button type="submit" class="btn btn-primary btn-full">Mettre à jour</button>
        </form>
    </div>
</section>

<script>
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formError = document.getElementById('formError');
    const formSuccess = document.getElementById('formSuccess');
    formError.textContent = '';
    formSuccess.textContent = '';

    const token = document.getElementById('token').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;

    if (!token || !password) {
        formError.textContent = 'Veuillez remplir tous les champs.';
        return;
    }
    if (password !== passwordConfirm) {
        formError.textContent = 'Les mots de passe ne correspondent pas.';
        return;
    }

    try {
        const apiBaseUrl = <?php echo json_encode(getApiBaseUrl()); ?>;
        const response = await fetch(`${apiBaseUrl}/users/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors de la réinitialisation');
        }
        formSuccess.textContent = data.message || 'Mot de passe mis à jour.';
        setTimeout(() => {
            window.location.href = '<?php echo url('index.php'); ?>';
        }, 1200);
    } catch (error) {
        formError.textContent = error.message;
    }
});
</script>

<?php require_once '../includes/footer.php'; ?>
