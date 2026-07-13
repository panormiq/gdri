<?php ?>

<section

    class="ugap-param-section-panel"

    id="ugap-section-liaisons"

    data-section-panel="liaisons"

    hidden

>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">

        <div>

            <h2 style="margin:0 0 6px;">Liaisons</h2>

            <p class="ugap-param-lead" style="margin:0;">

                Règles entre options : <strong>incompatibilités</strong> (mutex Base/MINO/MAJO),

                <strong>complémentaire</strong> (A ↔ B, réciproque),

                <strong>ajouts auto</strong> (déclencheur → +option) et <strong>prérequis &amp; variantes</strong>.

            </p>

        </div>

        <button type="button" id="ugap-liaisons-refresh" class="btn btn-outline">Rafraîchir</button>

    </div>



    <nav class="ugap-liaisons-sub-tabs" aria-label="Types de liaisons">

        <button type="button" class="ugap-liaisons-sub-tab is-active" data-liaisons-sub="incompatibility">Incompatibilités</button>

        <button type="button" class="ugap-liaisons-sub-tab" data-liaisons-sub="complementary">Complémentaire</button>

        <button type="button" class="ugap-liaisons-sub-tab" data-liaisons-sub="auto_add">Ajouts auto</button>

        <button type="button" class="ugap-liaisons-sub-tab" data-liaisons-sub="requires">Prérequis &amp; variantes</button>

    </nav>



    <div class="card ugap-liaisons-filters" style="margin-top:12px;padding:12px;" data-liaisons-panel="incompatibility">

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">

            <label style="display:flex;flex-direction:column;gap:4px;min-width:280px;flex:1;">

                <span style="font-size:12px;color:#64748b;">Recherche</span>

                <input

                    id="ugap-liaisons-filter-search"

                    type="search"

                    placeholder="Nom, libellé Excel, réf. UGAP, fournisseur…"

                    style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;"

                >

            </label>

            <label style="display:flex;flex-direction:column;gap:4px;min-width:220px;">

                <span style="font-size:12px;color:#64748b;">Nœud catalogue</span>

                <select id="ugap-liaisons-filter-node" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">

                    <option value="">Tous les nœuds</option>

                </select>

            </label>

            <label style="display:flex;flex-direction:column;gap:4px;min-width:220px;">

                <span style="font-size:12px;color:#64748b;">Modèle / poste</span>

                <select id="ugap-liaisons-filter-model" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">

                    <option value="">Tous les modèles</option>

                </select>

            </label>

            <label style="display:flex;flex-direction:column;gap:4px;min-width:180px;">

                <span style="font-size:12px;color:#64748b;">Type de ligne</span>

                <select id="ugap-liaisons-filter-tag" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">

                    <option value="all">Tous les types</option>

                    <option value="base">Base</option>

                    <option value="mino">MINO</option>

                    <option value="majo">MAJO</option>

                    <option value="catalogue">Catalogue</option>

                    <option value="pr">PR</option>

                </select>

            </label>

            <label style="display:flex;flex-direction:column;gap:4px;min-width:200px;">

                <span style="font-size:12px;color:#64748b;">Statut liaison</span>

                <select id="ugap-liaisons-filter-status" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;">

                    <option value="all">Toutes</option>

                    <option value="linked">Liées</option>

                    <option value="unlinked">Non liées</option>

                    <option value="implicit">Heuristique</option>

                    <option value="explicit">Persistées</option>

                </select>

            </label>

        </div>

    </div>



    <div id="ugap-liaisons-status" class="ugap-liaisons-status" hidden></div>

    <div id="ugap-liaisons-panel-mount" class="ugap-liaisons-panel-mount" data-liaisons-panel="incompatibility"></div>

</section>


