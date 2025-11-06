/**
 * Gestionnaire du modal de configuration des services
 * Fichier : assets/js/service-setup-modal.js
 * 
 * Gère l'affichage et la configuration des services nécessitant une configuration
 */

class ServiceSetupModal {
  constructor() {
    this.apiBaseUrl = window.API_BASE_URL || 'http://localhost:3000/api';
    this.jwtToken = window.JWT_TOKEN || null;
    this.services = [];
    this.configs = {}; // Stocke les configurations par service
    this.modal = null;
    this.init();
  }

  /**
   * Initialise le modal
   */
  init() {
    this.modal = document.getElementById('serviceSetupModal');
    if (!this.modal) {
      console.error('Modal serviceSetupModal non trouvé');
      return;
    }

    // Événements
    const closeBtn = document.getElementById('closeServiceSetupModal');
    const configureLaterBtn = document.getElementById('configureLaterBtn');
    const saveAllBtn = document.getElementById('saveAllConfigsBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (configureLaterBtn) {
      configureLaterBtn.addEventListener('click', () => this.configureLater());
    }

    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => this.saveAllConfigs());
    }

    // Fermer en cliquant sur l'overlay
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });
  }

  /**
   * Charge les services non configurés depuis l'API
   */
  async loadUnconfiguredServices() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/services/unconfigured`, {
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des services');
      }

      const data = await response.json();
      this.services = data.data || [];
      return this.services;

    } catch (error) {
      console.error('Erreur loadUnconfiguredServices:', error);
      return [];
    }
  }

  /**
   * Affiche le modal avec les services à configurer
   */
  async show() {
    // Charger les services
    const services = await this.loadUnconfiguredServices();

    if (services.length === 0) {
      // Aucun service à configurer
      const noServicesMsg = document.getElementById('noServicesMessage');
      const tabsContainer = document.getElementById('serviceTabsContainer');
      if (noServicesMsg) noServicesMsg.style.display = 'block';
      if (tabsContainer) tabsContainer.style.display = 'none';
    } else {
      // Afficher les onglets
      const noServicesMsg = document.getElementById('noServicesMessage');
      const tabsContainer = document.getElementById('serviceTabsContainer');
      if (noServicesMsg) noServicesMsg.style.display = 'none';
      if (tabsContainer) tabsContainer.style.display = 'block';

      this.renderTabs(services);
    }

    // Afficher le modal
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Ferme le modal
   */
  close() {
    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Rend les onglets et leur contenu
   */
  renderTabs(services) {
    const tabsHeader = document.getElementById('serviceTabsHeader');
    const tabsContent = document.getElementById('serviceTabsContent');
    const saveAllBtn = document.getElementById('saveAllConfigsBtn');

    if (!tabsHeader || !tabsContent) return;

    // Vider le contenu
    tabsHeader.innerHTML = '';
    tabsContent.innerHTML = '';

    // Créer les onglets
    services.forEach((service, index) => {
      const serviceId = service._id;
      const serviceName = service.service_name || 'unknown';

      // Onglet
      const tabButton = document.createElement('button');
      tabButton.className = `tab-button ${index === 0 ? 'active' : ''}`;
      tabButton.textContent = `${service.icon} ${service.name}`;
      tabButton.dataset.serviceId = serviceId;
      tabButton.dataset.serviceName = serviceName;
      tabButton.addEventListener('click', () => this.switchTab(serviceId));
      tabsHeader.appendChild(tabButton);

      // Contenu de l'onglet
      const tabContent = document.createElement('div');
      tabContent.className = `tab-content ${index === 0 ? 'active' : ''}`;
      tabContent.id = `tab-${serviceId}`;
      tabContent.innerHTML = this.renderServiceForm(service);
      tabsContent.appendChild(tabContent);

      // Initialiser les événements pour Facebook après création du contenu
      if (serviceName === 'facebook') {
        // Utiliser setTimeout pour s'assurer que le DOM est prêt
        setTimeout(() => {
          // Bouton ajouter intention
          const addIntentionBtn = document.getElementById('facebook-add-intention-btn');
          if (addIntentionBtn) {
            const newAddIntentionBtn = addIntentionBtn.cloneNode(true);
            addIntentionBtn.parentNode.replaceChild(newAddIntentionBtn, addIntentionBtn);
            newAddIntentionBtn.addEventListener('click', () => {
              this.addFacebookIntention();
            });
          }
          
          // Bouton ajouter SMTP
          const addSmtpBtn = document.getElementById('facebook-add-smtp-btn');
          if (addSmtpBtn) {
            const newAddSmtpBtn = addSmtpBtn.cloneNode(true);
            addSmtpBtn.parentNode.replaceChild(newAddSmtpBtn, addSmtpBtn);
            newAddSmtpBtn.addEventListener('click', () => {
              this.addFacebookSmtpProfile();
            });
          }
          
          // Initialiser les intentions par défaut si la liste est vide
          this.initializeDefaultFacebookIntentions();
          
          // Ne pas charger le SMTP par défaut ici, il sera chargé dans loadServiceConfig si nécessaire
        }, 50);
      }

      // Initialiser les valeurs si config partielle existe
      if (service.config) {
        setTimeout(() => {
          this.loadServiceConfig(serviceId, serviceName, service.config);
        }, 100);
      } else {
        // Si pas de config, charger le SMTP par défaut du module mail pour Facebook
        if (serviceName === 'facebook') {
          setTimeout(() => {
            this.loadDefaultMailSmtp();
          }, 150);
        }
      }
    });

    // Afficher le bouton sauvegarder
    if (saveAllBtn) {
      saveAllBtn.style.display = 'inline-block';
    }
  }

  /**
   * Rend le formulaire de configuration pour un service
   */
  renderServiceForm(service) {
    const serviceName = service.service_name || 'unknown';

    // Déléguer au renderer spécifique selon le service
    switch (serviceName) {
      case 'mail':
        return this.renderMailForm(service);
      case 'facebook':
        return this.renderFacebookForm(service);
      default:
        return this.renderGenericForm(service);
    }
  }

  /**
   * Rend le formulaire de configuration pour Mail
   */
  renderMailForm(service) {
    return `
      <div class="service-config-form" data-service-name="mail">
        <div class="form-group">
          <label for="mail-smtp-host">Serveur SMTP *</label>
          <input type="text" id="mail-smtp-host" class="form-control" placeholder="smtp.gmail.com" required />
          <small class="form-text">Adresse du serveur SMTP</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="mail-smtp-port">Port SMTP *</label>
            <input type="number" id="mail-smtp-port" class="form-control" placeholder="587" value="587" required />
            <small class="form-text">Port du serveur SMTP (généralement 587 ou 465)</small>
          </div>

          <div class="form-group">
            <label for="mail-smtp-secure">Sécurité</label>
            <select id="mail-smtp-secure" class="form-control">
              <option value="false">Aucune</option>
              <option value="true" selected>TLS/SSL</option>
            </select>
            <small class="form-text">Type de sécurité</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="mail-smtp-user">Utilisateur SMTP *</label>
            <input type="text" id="mail-smtp-user" class="form-control" placeholder="votre@email.com" required />
            <small class="form-text">Email ou nom d'utilisateur SMTP</small>
          </div>

          <div class="form-group">
            <label for="mail-smtp-pass">Mot de passe SMTP *</label>
            <input type="password" id="mail-smtp-pass" class="form-control" placeholder="••••••••" required />
            <small class="form-text">Mot de passe ou token d'application</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="mail-from-name">Nom expéditeur *</label>
            <input type="text" id="mail-from-name" class="form-control" placeholder="GDR-Innovation" required />
            <small class="form-text">Nom affiché dans les emails envoyés</small>
          </div>

          <div class="form-group">
            <label for="mail-from-email">Email expéditeur *</label>
            <input type="email" id="mail-from-email" class="form-control" placeholder="noreply@example.com" required />
            <small class="form-text">Adresse email d'expédition</small>
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="mail-use-default" />
            Utiliser le serveur SMTP par défaut du système
          </label>
          <small class="form-text">Si coché, les paramètres ci-dessus seront ignorés et le serveur par défaut sera utilisé</small>
        </div>
      </div>
    `;
  }

  /**
   * Rend le formulaire de configuration pour Facebook
   */
  renderFacebookForm(service) {
    return `
      <div class="service-config-form" data-service-name="facebook">
        <div class="form-group">
          <label for="facebook-base-prompt">Prompt de base *</label>
          <textarea 
            id="facebook-base-prompt" 
            class="form-control" 
            rows="8" 
            placeholder="Analysez le message suivant et déterminez son intention parmi : {liste des intention}

Pour chaque intention détectée, indiquez :
- La catégorie d'intention
- Le niveau de certitude (0-100%)
- Si une action urgente est requise"
            required
          ></textarea>
          <small class="form-text">Utilisez <code>{liste des intention}</code> dans votre prompt pour insérer automatiquement la liste des intentions configurées ci-dessous</small>
        </div>

        <div class="form-group">
          <label>Liste des intentions</label>
          <div id="facebook-intentions-list" class="intentions-list">
            <!-- Les intentions seront ajoutées ici -->
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="facebook-add-intention-btn">
            + Ajouter une intention
          </button>
          <small class="form-text">Ajoutez les intentions que l'agent doit détecter. Elles seront automatiquement insérées dans le prompt via {liste des intention}</small>
        </div>

        <div class="form-group">
          <label for="facebook-default-email">Email par défaut *</label>
          <input type="email" id="facebook-default-email" class="form-control" placeholder="alerts@example.com" required />
          <small class="form-text">Email utilisé par défaut pour toutes les intentions non configurées</small>
        </div>

        <div class="form-group">
          <label for="facebook-report-hour">Heure du rapport quotidien</label>
          <input type="time" id="facebook-report-hour" class="form-control" value="20:00" />
          <small class="form-text">Heure à laquelle le rapport quotidien sera envoyé (format HH:MM)</small>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="facebook-instant-notification" checked />
            Envoyer des notifications instantanées pour les urgences
          </label>
          <small class="form-text">Si activé, un email sera envoyé immédiatement lorsqu'une intention urgente est détectée</small>
        </div>

        <div class="form-group">
          <label>Profils SMTP</label>
          <div id="facebook-smtp-profiles-list" class="smtp-profiles-list">
            <!-- Les profils SMTP seront ajoutés ici -->
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="facebook-add-smtp-btn">
            + Créer un SMTP
          </button>
          <small class="form-text">Ajoutez des profils SMTP. Le profil du module Mail sera chargé par défaut s'il existe.</small>
        </div>
      </div>
    `;
  }

  /**
   * Rend un formulaire générique pour les services non spécifiques
   */
  renderGenericForm(service) {
    return `
      <div class="service-config-form" data-service-name="generic">
        <p class="text-muted">Configuration pour ${service.name}</p>
        <p class="text-muted">Cette configuration sera disponible prochainement.</p>
      </div>
    `;
  }

  /**
   * Change d'onglet
   */
  switchTab(serviceId) {
    // Désactiver tous les onglets
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Activer l'onglet sélectionné
    const selectedButton = document.querySelector(`[data-service-id="${serviceId}"]`);
    const selectedContent = document.getElementById(`tab-${serviceId}`);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
  }

  /**
   * Charge la configuration existante dans le formulaire
   */
  loadServiceConfig(serviceId, serviceName, config) {
    // Implémentation selon le service
    switch (serviceName) {
      case 'mail':
        if (config.use_default) {
          const checkbox = document.getElementById('mail-use-default');
          if (checkbox) checkbox.checked = true;
        } else if (config.smtp_profiles) {
          const profile = Object.values(config.smtp_profiles)[0];
          if (profile) {
            const hostInput = document.getElementById('mail-smtp-host');
            const portInput = document.getElementById('mail-smtp-port');
            const secureInput = document.getElementById('mail-smtp-secure');
            const userInput = document.getElementById('mail-smtp-user');
            const passInput = document.getElementById('mail-smtp-pass');
            const fromNameInput = document.getElementById('mail-from-name');
            const fromEmailInput = document.getElementById('mail-from-email');

            if (hostInput && profile.smtp?.host) hostInput.value = profile.smtp.host;
            if (portInput && profile.smtp?.port) portInput.value = profile.smtp.port;
            if (secureInput && profile.smtp?.secure !== undefined) {
              secureInput.value = profile.smtp.secure ? 'true' : 'false';
            }
            if (userInput && profile.smtp?.auth?.user) userInput.value = profile.smtp.auth.user;
            if (passInput && profile.smtp?.auth?.pass) passInput.value = profile.smtp.auth.pass;
            if (fromNameInput && profile.from?.name) fromNameInput.value = profile.from.name;
            if (fromEmailInput && profile.from?.email) fromEmailInput.value = profile.from.email;
          }
        }
        break;
      case 'facebook':
        if (config.base_prompt) {
          const promptInput = document.getElementById('facebook-base-prompt');
          if (promptInput) promptInput.value = config.base_prompt;
        }
        if (config.intentions && Array.isArray(config.intentions) && config.intentions.length > 0) {
          const intentionsList = document.getElementById('facebook-intentions-list');
          if (intentionsList) {
            intentionsList.innerHTML = '';
            config.intentions.forEach(intention => {
              this.addFacebookIntention(intention);
            });
          }
        } else {
          // Si pas d'intentions configurées, initialiser avec les intentions par défaut
          this.initializeDefaultFacebookIntentions();
        }
        if (config.smtp_profiles && Object.keys(config.smtp_profiles).length > 0) {
          const smtpList = document.getElementById('facebook-smtp-profiles-list');
          if (smtpList) {
            smtpList.innerHTML = '';
            Object.entries(config.smtp_profiles).forEach(([profileKey, profile]) => {
              this.addFacebookSmtpProfile({
                name: profileKey.charAt(0).toUpperCase() + profileKey.slice(1).replace(/_/g, ' '),
                host: profile.smtp?.host || '',
                port: profile.smtp?.port || 587,
                secure: profile.smtp?.secure !== undefined ? profile.smtp.secure : true,
                user: profile.auth?.user || '',
                pass: profile.auth?.pass || '',
                from_name: profile.from?.name || '',
                from_email: profile.from?.email || ''
              });
            });
          }
        } else {
          // Si pas de profils SMTP configurés, charger celui du module mail
          // Vérifier d'abord si la liste est vide
          const smtpList = document.getElementById('facebook-smtp-profiles-list');
          if (smtpList && smtpList.children.length === 0) {
            this.loadDefaultMailSmtp();
          }
        }
        if (config.default_email) {
          const emailInput = document.getElementById('facebook-default-email');
          if (emailInput) emailInput.value = config.default_email;
        }
        if (config.daily_report?.hour !== undefined) {
          const hourInput = document.getElementById('facebook-report-hour');
          if (hourInput) {
            const hour = config.daily_report.hour || 20;
            const minute = config.daily_report.minute || 0;
            hourInput.value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          }
        }
        if (config.instant_notification !== undefined) {
          const checkbox = document.getElementById('facebook-instant-notification');
          if (checkbox) checkbox.checked = config.instant_notification;
        }
        break;
    }
  }

  /**
   * Initialise les intentions par défaut pour Facebook
   */
  initializeDefaultFacebookIntentions() {
    const intentionsList = document.getElementById('facebook-intentions-list');
    if (!intentionsList || intentionsList.children.length > 0) {
      return; // Déjà des intentions, ne pas initialiser
    }

    const defaultIntentions = [
      { name: 'commercial', email: '', urgent: false },
      { name: 'sav', email: '', urgent: true },
      { name: 'technique', email: '', urgent: false },
      { name: 'critique', email: '', urgent: true },
      { name: 'positif', email: '', urgent: false },
      { name: 'spam', email: '', urgent: false },
      { name: 'generic', email: '', urgent: false }
    ];

    defaultIntentions.forEach(intention => {
      this.addFacebookIntention(intention);
    });
  }

  /**
   * Ajoute une intention au formulaire Facebook
   */
  addFacebookIntention(intentionData = null) {
    const intentionsList = document.getElementById('facebook-intentions-list');
    if (!intentionsList) return;

    const intentionItem = document.createElement('div');
    intentionItem.className = 'intention-item';
    intentionItem.innerHTML = `
      <div class="intention-item-content">
        <div class="form-row">
          <div class="form-group col-md-5">
            <input 
              type="text" 
              class="form-control intention-name" 
              placeholder="Nom de l'intention (ex: commercial, sav, technique...)" 
              value="${intentionData?.name || ''}"
              required
            />
          </div>
          <div class="form-group col-md-5">
            <input 
              type="email" 
              class="form-control intention-email" 
              placeholder="Email pour cette intention" 
              value="${intentionData?.email || ''}"
              required
            />
          </div>
          <div class="form-group col-md-2">
            <button type="button" class="btn btn-danger btn-sm btn-block remove-intention">🗑️</button>
          </div>
        </div>
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              class="intention-urgent" 
              ${intentionData?.urgent ? 'checked' : ''}
            />
            Notification urgente (envoi immédiat)
          </label>
        </div>
      </div>
    `;

    // Gérer la suppression
    intentionItem.querySelector('.remove-intention').addEventListener('click', () => {
      intentionItem.remove();
    });

    intentionsList.appendChild(intentionItem);
  }

  /**
   * Charge le SMTP par défaut du module mail
   */
  async loadDefaultMailSmtp() {
    try {
      // Vérifier si la liste est déjà remplie
      const smtpList = document.getElementById('facebook-smtp-profiles-list');
      if (!smtpList || smtpList.children.length > 0) {
        return; // Déjà des profils, ne pas charger
      }

      const response = await fetch(`${this.apiBaseUrl}/mail/config/mail`, {
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return; // Pas de config mail, on continue sans
      }

      const data = await response.json();
      
      if (data.success && data.config && data.config.smtp_profiles) {
        // Récupérer le premier profil (ou le profil 'default')
        const profileKey = data.config.smtp_profiles['default'] ? 'default' : Object.keys(data.config.smtp_profiles)[0];
        const profile = data.config.smtp_profiles[profileKey];
        
        if (profile) {
          // Vérifier à nouveau qu'on n'a toujours pas de profils (race condition)
          if (smtpList.children.length === 0) {
            // Ajouter le profil mail comme profil par défaut
            this.addFacebookSmtpProfile({
              name: 'Mail (par défaut)',
              host: profile.smtp?.host || '',
              port: profile.smtp?.port || 587,
              secure: profile.smtp?.secure !== undefined ? profile.smtp.secure : true,
              user: profile.auth?.user || '',
              pass: profile.auth?.pass || '',
              from_name: profile.from?.name || '',
              from_email: profile.from?.email || '',
              is_default: true
            });
          }
        }
      }
    } catch (error) {
      console.log('Pas de configuration mail trouvée, continuer sans profil par défaut');
    }
  }

  /**
   * Ajoute un profil SMTP au formulaire Facebook
   */
  addFacebookSmtpProfile(profileData = null) {
    const smtpList = document.getElementById('facebook-smtp-profiles-list');
    if (!smtpList) return;

    const smtpItem = document.createElement('div');
    smtpItem.className = 'smtp-profile-item';
    const profileId = `smtp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    smtpItem.dataset.profileId = profileId;
    
    smtpItem.innerHTML = `
      <div class="smtp-profile-header">
        <h4>${profileData?.name || 'Nouveau profil SMTP'}</h4>
        <button type="button" class="btn btn-danger btn-sm remove-smtp-profile">🗑️</button>
      </div>
      <div class="smtp-profile-content">
        <div class="form-group">
          <label>Nom du profil</label>
          <input 
            type="text" 
            class="form-control smtp-profile-name" 
            placeholder="Nom du profil (ex: Gmail, Outlook...)" 
            value="${profileData?.name || ''}"
            required
          />
        </div>
        <div class="form-row">
          <div class="form-group col-md-6">
            <label>Serveur SMTP *</label>
            <input 
              type="text" 
              class="form-control smtp-host" 
              placeholder="smtp.gmail.com" 
              value="${profileData?.host || ''}"
              required
            />
          </div>
          <div class="form-group col-md-3">
            <label>Port *</label>
            <input 
              type="number" 
              class="form-control smtp-port" 
              placeholder="587" 
              value="${profileData?.port || 587}"
              required
            />
          </div>
          <div class="form-group col-md-3">
            <label>Sécurité</label>
            <select class="form-control smtp-secure">
              <option value="false" ${profileData?.secure === false ? 'selected' : ''}>Aucune</option>
              <option value="true" ${profileData?.secure !== false ? 'selected' : ''}>TLS/SSL</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group col-md-6">
            <label>Utilisateur SMTP *</label>
            <input 
              type="text" 
              class="form-control smtp-user" 
              placeholder="user@example.com" 
              value="${profileData?.user || ''}"
              required
            />
          </div>
          <div class="form-group col-md-6">
            <label>Mot de passe SMTP *</label>
            <input 
              type="password" 
              class="form-control smtp-pass" 
              placeholder="••••••••" 
              value="${profileData?.pass || ''}"
              required
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group col-md-6">
            <label>Nom expéditeur *</label>
            <input 
              type="text" 
              class="form-control smtp-from-name" 
              placeholder="GDR-Innovation" 
              value="${profileData?.from_name || ''}"
              required
            />
          </div>
          <div class="form-group col-md-6">
            <label>Email expéditeur *</label>
            <input 
              type="email" 
              class="form-control smtp-from-email" 
              placeholder="noreply@example.com" 
              value="${profileData?.from_email || ''}"
              required
            />
          </div>
        </div>
        ${profileData?.is_default ? '<div class="alert alert-info">📧 Profil chargé depuis la configuration Mail</div>' : ''}
      </div>
    `;

    // Gérer la suppression
    smtpItem.querySelector('.remove-smtp-profile').addEventListener('click', () => {
      smtpItem.remove();
    });

    // Mettre à jour le titre quand le nom change
    const nameInput = smtpItem.querySelector('.smtp-profile-name');
    const titleElement = smtpItem.querySelector('.smtp-profile-header h4');
    if (nameInput && titleElement) {
      nameInput.addEventListener('input', () => {
        titleElement.textContent = nameInput.value || 'Nouveau profil SMTP';
      });
    }

    smtpList.appendChild(smtpItem);
  }

  /**
   * Collecte toutes les configurations des formulaires
   */
  collectAllConfigs() {
    const configs = {};

    this.services.forEach(service => {
      const serviceId = service._id.toString();
      const serviceName = service.service_name || 'unknown';
      const config = this.collectServiceConfig(serviceId, serviceName);
      if (config) {
        configs[serviceId] = config;
      }
    });

    return configs;
  }

  /**
   * Collecte la configuration d'un service spécifique
   */
  collectServiceConfig(serviceId, serviceName) {
    switch (serviceName) {
      case 'mail':
        return this.collectMailConfig();
      case 'facebook':
        return this.collectFacebookConfig();
      default:
        return null;
    }
  }

  /**
   * Collecte la configuration Mail
   */
  collectMailConfig() {
    const useDefault = document.getElementById('mail-use-default')?.checked || false;

    if (useDefault) {
      return { use_default: true };
    }

    const host = document.getElementById('mail-smtp-host')?.value;
    const port = parseInt(document.getElementById('mail-smtp-port')?.value || '587');
    const secure = document.getElementById('mail-smtp-secure')?.value === 'true';
    const user = document.getElementById('mail-smtp-user')?.value;
    const pass = document.getElementById('mail-smtp-pass')?.value;
    const fromName = document.getElementById('mail-from-name')?.value;
    const fromEmail = document.getElementById('mail-from-email')?.value;

    if (!host || !user || !pass || !fromName || !fromEmail) {
      return null; // Configuration incomplète
    }

    return {
      use_default: false,
      smtp_profiles: {
        default: {
          smtp: {
            host,
            port,
            secure
          },
          auth: {
            user,
            pass
          },
          from: {
            name: fromName,
            email: fromEmail
          }
        }
      }
    };
  }

  /**
   * Collecte la configuration Facebook
   */
  collectFacebookConfig() {
    const basePrompt = document.getElementById('facebook-base-prompt')?.value || '';
    const defaultEmail = document.getElementById('facebook-default-email')?.value;
    const reportTime = document.getElementById('facebook-report-hour')?.value || '20:00';
    const instantNotification = document.getElementById('facebook-instant-notification')?.checked || false;

    // Collecter les intentions
    const intentions = [];
    const intentionItems = document.querySelectorAll('#facebook-intentions-list .intention-item');
    intentionItems.forEach(item => {
      const intentionName = item.querySelector('.intention-name')?.value?.trim();
      const intentionEmail = item.querySelector('.intention-email')?.value?.trim();
      const intentionUrgent = item.querySelector('.intention-urgent')?.checked || false;
      
      if (intentionName && intentionEmail) {
        intentions.push({
          name: intentionName,
          email: intentionEmail,
          urgent: intentionUrgent
        });
      }
    });

    // Collecter les profils SMTP
    const smtpProfiles = {};
    const smtpItems = document.querySelectorAll('#facebook-smtp-profiles-list .smtp-profile-item');
    smtpItems.forEach(item => {
      const profileName = item.querySelector('.smtp-profile-name')?.value?.trim();
      const host = item.querySelector('.smtp-host')?.value?.trim();
      const port = parseInt(item.querySelector('.smtp-port')?.value || '587');
      const secure = item.querySelector('.smtp-secure')?.value === 'true';
      const user = item.querySelector('.smtp-user')?.value?.trim();
      const pass = item.querySelector('.smtp-pass')?.value?.trim();
      const fromName = item.querySelector('.smtp-from-name')?.value?.trim();
      const fromEmail = item.querySelector('.smtp-from-email')?.value?.trim();
      
      if (profileName && host && user && pass && fromName && fromEmail) {
        const profileKey = profileName.toLowerCase().replace(/\s+/g, '_');
        smtpProfiles[profileKey] = {
          smtp: {
            host,
            port,
            secure
          },
          auth: {
            user,
            pass
          },
          from: {
            name: fromName,
            email: fromEmail
          }
        };
      }
    });

    const [hour, minute] = reportTime.split(':').map(Number);

    return {
      base_prompt: basePrompt,
      intentions: intentions,
      default_email: defaultEmail,
      smtp_profiles: smtpProfiles,
      daily_report: {
        enabled: true,
        hour: hour || 20,
        minute: minute || 0
      },
      instant_notification: instantNotification
    };
  }

  /**
   * Sauvegarde toutes les configurations
   */
  async saveAllConfigs() {
    const configs = this.collectAllConfigs();
    const savePromises = [];

    for (const [serviceId, config] of Object.entries(configs)) {
      if (config) {
        savePromises.push(this.saveServiceConfig(serviceId, config));
      }
    }

    try {
      await Promise.all(savePromises);
      alert('✅ Toutes les configurations ont été sauvegardées avec succès !');
      this.close();
      // Recharger la page pour mettre à jour l'état
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde des configurations');
    }
  }

  /**
   * Sauvegarde la configuration d'un service
   */
  async saveServiceConfig(serviceId, config) {
    const response = await fetch(`${this.apiBaseUrl}/services/${serviceId}/config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur lors de la sauvegarde');
    }

    return await response.json();
  }

  /**
   * Marque tous les services comme "configurés plus tard"
   */
  async configureLater() {
    const confirmLater = confirm('Êtes-vous sûr de vouloir configurer ces services plus tard ?');
    if (!confirmLater) return;

    const markPromises = this.services.map(service => {
      return fetch(`${this.apiBaseUrl}/services/${service._id}/config/later`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
    });

    try {
      await Promise.all(markPromises);
      this.close();
    } catch (error) {
      console.error('Erreur configureLater:', error);
      alert('❌ Erreur lors de la sauvegarde');
    }
  }
}

// Instance globale
let serviceSetupModal = null;

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  serviceSetupModal = new ServiceSetupModal();
  
  // Exposer globalement pour être appelé depuis d'autres scripts
  window.serviceSetupModal = serviceSetupModal;
});

