    if ($user) {
        $currentEntrepriseId = isset($user['currentEntrepriseId']) 
            ? (string) $user['currentEntrepriseId'] 
            : null;
        
        // Récupérer toutes les entreprises de l'utilisateur (pour le menu)
        $userEntreprisesList = $user['entreprises'] ?? [];
        $entrepriseIds = [];
        foreach ($userEntreprisesList as $ue) {
            if (isset($ue['entrepriseId'])) {
                $entrepriseIds[] = new MongoDB\BSON\ObjectId((string) $ue['entrepriseId']);
            }
        }
        
        if (!empty($entrepriseIds)) {
            $userEntreprises = $entitiesCollection->find([
                '_id' => ['$in' => $entrepriseIds],
                'status' => 'active'
            ])->toArray();
            
            // Récupérer l'entreprise active
            if ($currentEntrepriseId) {
                $currentEntreprise = $entitiesCollection->findOne([
                    '_id' => new MongoDB\BSON\ObjectId($currentEntrepriseId),
                    'status' => 'active'
                ]);
            }
            
            // Si pas d'entreprise active définie mais qu'il y a des entreprises disponibles, prendre la première
            if (!$currentEntreprise && !empty($userEntreprises)) {
                $currentEntreprise = $userEntreprises[0];
                $currentEntrepriseId = (string) $currentEntreprise['_id'];
            }
        }
    }
