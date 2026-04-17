<?php
/**
 * Première connexion - Définir le mot de passe
 * Fichier : pages/first-connection.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

$page_title = 'Première connexion';
$token = $_GET['token'] ?? '';

require_once '../includes/header.php';
?>

<section class="section">
    <div class="container" style="max-width: 520px;">
        <div class="section-title">
            <h2>Première connexion</h2>
            <p>Définissez votre mot de passe pour activer votre compte.</p>
        </div>

        <form id="firstConnectionForm">
            <div class="form-group">
                <label for="token">Token d'invitation *</label>
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

            <button type="submit" class="btn btn-primary btn-full">Activer mon compte</button>
        </form>
    </div>
</section>

<script>
document.getElementById('firstConnectionForm').addEventListener('submit', async (e) => {
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
        const response = await fetch(`${apiBaseUrl}/users/first-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors de l\'activation');
        }
        formSuccess.textContent = data.message || 'Compte activé avec succès.';
        setTimeout(() => {
            window.location.href = '<?php echo url('index.php'); ?>';
        }, 1200);
    } catch (error) {
        formError.textContent = error.message;
    }
});
</script>

<?php require_once '../includes/footer.php'; ?>
