/**
 * Méthode d'extraction : Image
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-image.js
 * 
 * Fonction : Extrait une image Word et ses propriétés
 * - Référence vers le fichier image
 * - Position (x, y) si anchor
 * - Dimensions (width, height)
 * - Rotation
 * - Crop/rognage
 * - Bordures (borders)
 * - Ombres (shadows)
 * - Ancrage (inline vs anchor)
 */

class ExtractImage {
  /**
   * Extrait une image depuis le XML Word
   * @param {Object} imageXml - Élément XML de l'image (w:drawing ou wp:anchor)
   * @param {Array} images - Liste des images extraites du ZIP
   * @param {Object} relationshipsObj - Relations du document (pour trouver l'image via rId)
   * @returns {Object} Image extraite
   */
  static extract(imageXml, images = [], relationshipsObj = null) {
    if (!imageXml || typeof imageXml !== 'object') {
      return ExtractImage.getDefaultImage();
    }

    // Déterminer le type d'élément : wp:anchor, wp:inline, ou w:drawing
    // Dans word-tags-config, on peut recevoir directement wp:anchor ou w:drawing
    let anchorElement = null;
    let inlineElement = null;
    let drawingElement = null;
    let isAnchor = false;

    // Vérifier si c'est un wp:anchor (image positionnée absolument)
    if (imageXml['wp:anchor'] !== undefined) {
      anchorElement = Array.isArray(imageXml['wp:anchor']) 
        ? imageXml['wp:anchor'][0] 
        : imageXml['wp:anchor'];
      isAnchor = true;
    }
    // Vérifier si c'est un wp:inline (image dans le flux)
    else if (imageXml['wp:inline'] !== undefined) {
      inlineElement = Array.isArray(imageXml['wp:inline']) 
        ? imageXml['wp:inline'][0] 
        : imageXml['wp:inline'];
    }
    // Vérifier si c'est directement un w:drawing
    else if (imageXml['w:drawing'] !== undefined) {
      drawingElement = Array.isArray(imageXml['w:drawing']) 
        ? imageXml['w:drawing'][0] 
        : imageXml['w:drawing'];
    }
    // Sinon, peut-être que l'élément lui-même est un anchor ou inline
    else if (imageXml['$'] && (imageXml['a:graphic'] || imageXml['pic:pic'])) {
      // C'est peut-être déjà un élément de dessin
      drawingElement = imageXml;
    }

    // Extraire les propriétés de base
    const result = {
      type: 'image',
      id: `img_${Date.now()}_${Math.random()}`,
      src: '',
      width: 0,
      height: 0,
      position: {
        x: 0,
        y: 0,
        isAbsolute: isAnchor
      },
      rotation: 0,
      crop: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      },
      borders: {
        enabled: false,
        width: 0,
        color: '#000000',
        style: 'solid'
      },
      shadow: {
        enabled: false,
        blur: 0,
        offsetX: 0,
        offsetY: 0,
        color: '#000000',
        opacity: 0.3
      },
      locked: {
        position: isAnchor, // Les anchors sont généralement verrouillés en position
        width: false,
        height: false,
        crop: false
      }
    };

    // Extraire depuis anchor ou inline
    if (anchorElement) {
      ExtractImage.extractFromAnchor(anchorElement, result, relationshipsObj, images);
    } else if (inlineElement) {
      ExtractImage.extractFromInline(inlineElement, result, relationshipsObj, images);
    } else if (drawingElement) {
      ExtractImage.extractFromDrawing(drawingElement, result, relationshipsObj, images);
    }

    return result;
  }

  /**
   * Extrait les propriétés depuis un wp:anchor (image positionnée absolument)
   */
  static extractFromAnchor(anchorElement, result, relationshipsObj, images) {
    // Position (wp:positionH, wp:positionV)
    const positionH = anchorElement['wp:positionH'];
    const positionV = anchorElement['wp:positionV'];
    
    if (positionH) {
      const posH = Array.isArray(positionH) ? positionH[0] : positionH;
      const posHValue = posH['wp:posOffset'];
      if (posHValue && posHValue[0]) {
        // posOffset est en EMU (English Metric Units), 1 EMU = 1/914400 inch
        result.position.x = ExtractImage.emuToPoints(parseInt(posHValue[0]) || 0);
      }
    }
    
    if (positionV) {
      const posV = Array.isArray(positionV) ? positionV[0] : positionV;
      const posVValue = posV['wp:posOffset'];
      if (posVValue && posVValue[0]) {
        result.position.y = ExtractImage.emuToPoints(parseInt(posVValue[0]) || 0);
      }
    }

    // Extraire le drawing depuis l'anchor
      const drawing = anchorElement['a:graphic']?.[0]?.['a:graphicData']?.[0]?.['pic:pic'];
      if (drawing) {
        ExtractImage.extractDrawingProperties(drawing, result, relationshipsObj, images);
      }

    // Effets de bord (wp:effectExtent)
    const effectExtent = anchorElement['wp:effectExtent'];
    if (effectExtent) {
      const extent = Array.isArray(effectExtent) ? effectExtent[0] : effectExtent;
      const attrs = extent['$'] || {};
      // effectExtent définit les marges autour de l'image (pour les ombres, etc.)
      // l, t, r, b sont en EMU
      if (attrs['l']) {
        result.borders.width = Math.max(result.borders.width, ExtractImage.emuToPoints(parseInt(attrs['l']) || 0));
      }
    }
  }

  /**
   * Extrait les propriétés depuis un wp:inline (image dans le flux)
   */
  static extractFromInline(inlineElement, result, relationshipsObj, images) {
    // Dimensions (wp:extent)
    const extent = inlineElement['wp:extent'];
    if (extent) {
      const ext = Array.isArray(extent) ? extent[0] : extent;
      const attrs = ext['$'] || {};
      if (attrs['cx']) {
        result.width = ExtractImage.emuToPoints(parseInt(attrs['cx']) || 0);
      }
      if (attrs['cy']) {
        result.height = ExtractImage.emuToPoints(parseInt(attrs['cy']) || 0);
      }
    }

    // Extraire le drawing
      const drawing = inlineElement['a:graphic']?.[0]?.['a:graphicData']?.[0]?.['pic:pic'];
      if (drawing) {
        ExtractImage.extractDrawingProperties(drawing, result, relationshipsObj, images);
      }
  }

  /**
   * Extrait les propriétés depuis un w:drawing
   */
  static extractFromDrawing(drawingElement, result, relationshipsObj, images) {
    const graphic = drawingElement['a:graphic']?.[0]?.['a:graphicData']?.[0]?.['pic:pic'];
    if (graphic) {
      ExtractImage.extractDrawingProperties(graphic, result, relationshipsObj, images);
    }
  }

  /**
   * Extrait les propriétés depuis un pic:pic (élément de dessin)
   */
  static extractDrawingProperties(picElement, result, relationshipsObj, images) {
    // Référence vers l'image (pic:blipFill > a:blip > r:embed)
    const blipFill = picElement['pic:blipFill'];
    if (blipFill) {
      const blipFillArray = Array.isArray(blipFill) ? blipFill : [blipFill];
      for (const blip of blipFillArray) {
        const blipElement = blip['a:blip'];
        if (blipElement) {
          const blipArray = Array.isArray(blipElement) ? blipElement : [blipElement];
          for (const b of blipArray) {
            const attrs = b['$'] || {};
            const rId = attrs['r:embed'] || attrs['r:link'];
            
            if (rId && relationshipsObj) {
              // Trouver l'image dans les relations
              const relationship = this.findRelationship(relationshipsObj, rId);
              if (relationship) {
                const imageName = relationship.split('/').pop();
                result.src = imageName;
                
                // Trouver l'image dans la liste
                const image = images.find(img => img.name === imageName);
                if (image) {
                  result.src = image.name;
                }
              }
            }
          }
        }

        // Rognage (a:srcRect)
        const srcRect = blip['a:srcRect'];
        if (srcRect) {
          const rect = Array.isArray(srcRect) ? srcRect[0] : srcRect;
          const attrs = rect['$'] || {};
          // Les valeurs sont en pourcentage (0-100000)
          result.crop.left = (parseInt(attrs['l']) || 0) / 1000; // Convertir en pourcentage
          result.crop.top = (parseInt(attrs['t']) || 0) / 1000;
          result.crop.right = (parseInt(attrs['r']) || 0) / 1000;
          result.crop.bottom = (parseInt(attrs['b']) || 0) / 1000;
        }
      }
    }

    // Dimensions et transformation (pic:spPr > a:xfrm)
    const spPr = picElement['pic:spPr'];
    if (spPr) {
      const spPrArray = Array.isArray(spPr) ? spPr : [spPr];
      for (const sp of spPrArray) {
        const xfrm = sp['a:xfrm'];
        if (xfrm) {
          const xfrmArray = Array.isArray(xfrm) ? xfrm : [xfrm];
          for (const x of xfrmArray) {
            const attrs = x['$'] || {};
            
            // Rotation (rot en 60000èmes de degré)
            if (attrs['rot']) {
              result.rotation = parseInt(attrs['rot']) / 60000;
            }

            // Dimensions (a:ext)
            const ext = x['a:ext'];
            if (ext) {
              const extArray = Array.isArray(ext) ? ext : [ext];
              for (const e of extArray) {
                const extAttrs = e['$'] || {};
                if (extAttrs['cx'] && !result.width) {
                  result.width = this.emuToPoints(parseInt(extAttrs['cx']) || 0);
                }
                if (extAttrs['cy'] && !result.height) {
                  result.height = this.emuToPoints(parseInt(extAttrs['cy']) || 0);
                }
              }
            }
          }
        }

        // Bordures (a:ln)
        const ln = sp['a:ln'];
        if (ln) {
          const lnArray = Array.isArray(ln) ? ln : [ln];
          for (const line of lnArray) {
            result.borders.enabled = true;
            const attrs = line['$'] || {};
            
            // Largeur de la bordure (w en EMU)
            if (attrs['w']) {
              result.borders.width = ExtractImage.emuToPoints(parseInt(attrs['w']) || 0);
            }

            // Couleur (a:solidFill ou a:noFill)
            const solidFill = line['a:solidFill'];
            if (solidFill) {
              const fillArray = Array.isArray(solidFill) ? solidFill : [solidFill];
              for (const fill of fillArray) {
                const srgbClr = fill['a:srgbClr'];
                if (srgbClr) {
                  const clrArray = Array.isArray(srgbClr) ? srgbClr : [srgbClr];
                  for (const clr of clrArray) {
                    const clrAttrs = clr['$'] || {};
                    if (clrAttrs['val']) {
                      result.borders.color = '#' + clrAttrs['val'];
                    }
                  }
                }
              }
            }

            // Style de ligne (prstDash)
            const prstDash = line['a:prstDash'];
            if (prstDash) {
              const dashArray = Array.isArray(prstDash) ? prstDash : [prstDash];
              for (const dash of dashArray) {
                const dashAttrs = dash['$'] || {};
                if (dashAttrs['val']) {
                  result.borders.style = dashAttrs['val']; // solid, dash, dot, etc.
                }
              }
            }
          }
        }

        // Ombres (a:effectLst > a:outerShdw)
        const effectLst = sp['a:effectLst'];
        if (effectLst) {
          const effectArray = Array.isArray(effectLst) ? effectLst : [effectLst];
          for (const effect of effectArray) {
            const outerShdw = effect['a:outerShdw'];
            if (outerShdw) {
              const shadowArray = Array.isArray(outerShdw) ? outerShdw : [outerShdw];
              for (const shadow of shadowArray) {
                result.shadow.enabled = true;
                const attrs = shadow['$'] || {};

                // Décalage (dist en EMU)
                if (attrs['dist']) {
                  const dist = ExtractImage.emuToPoints(parseInt(attrs['dist']) || 0);
                  result.shadow.offsetX = dist;
                  result.shadow.offsetY = dist;
                }

                // Direction (dir en 60000èmes de degré)
                if (attrs['dir']) {
                  const dir = parseInt(attrs['dir']) / 60000;
                  const dist = ExtractImage.emuToPoints(parseInt(attrs['dist']) || 0);
                  result.shadow.offsetX = Math.cos(dir * Math.PI / 180) * dist;
                  result.shadow.offsetY = Math.sin(dir * Math.PI / 180) * dist;
                }

                // Flou (blurRad en EMU)
                const blurRad = shadow['a:blurRad'];
                if (blurRad) {
                  const blurArray = Array.isArray(blurRad) ? blurRad : [blurRad];
                  for (const blur of blurArray) {
                    const blurAttrs = blur['$'] || {};
                    if (blurAttrs['val']) {
                      result.shadow.blur = ExtractImage.emuToPoints(parseInt(blurAttrs['val']) || 0);
                    }
                  }
                }

                // Couleur de l'ombre (a:srgbClr)
                const srgbClr = shadow['a:srgbClr'];
                if (srgbClr) {
                  const clrArray = Array.isArray(srgbClr) ? srgbClr : [srgbClr];
                  for (const clr of clrArray) {
                    const clrAttrs = clr['$'] || {};
                    if (clrAttrs['val']) {
                      result.shadow.color = '#' + clrAttrs['val'];
                    }
                    // Opacité (alpha)
                    const alpha = clr['a:alpha'];
                    if (alpha) {
                      const alphaArray = Array.isArray(alpha) ? alpha : [alpha];
                      for (const a of alphaArray) {
                        const alphaAttrs = a['$'] || {};
                        if (alphaAttrs['val']) {
                          // val est en 1000èmes (100000 = 100%)
                          result.shadow.opacity = parseInt(alphaAttrs['val']) / 1000;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Trouve une relation dans relationshipsObj
   */
  static findRelationship(relationshipsObj, rId) {
    if (!relationshipsObj || !rId) {
      return null;
    }

    // Structure peut varier selon le parsing
    let relationships = null;
    if (relationshipsObj['Relationships']) {
      relationships = relationshipsObj['Relationships'];
    } else if (relationshipsObj['r:Relationships']) {
      relationships = relationshipsObj['r:Relationships'];
    } else if (Array.isArray(relationshipsObj)) {
      relationships = relationshipsObj;
    }

    if (!relationships) {
      return null;
    }

    const relArray = Array.isArray(relationships) ? relationships : [relationships];
    for (const rel of relArray) {
      const attrs = rel['$'] || {};
      if (attrs['Id'] === rId || attrs['r:id'] === rId) {
        return attrs['Target'] || attrs['r:target'];
      }
    }

    return null;
  }

  /**
   * Convertit des EMU (English Metric Units) en points
   * 1 EMU = 1/914400 inch = 1/12700 point
   * @param {number} emu - Valeur en EMU
   * @returns {number} Valeur en points
   */
  static emuToPoints(emu) {
    return emu / 12700;
  }

  /**
   * Retourne une image par défaut
   */
  static getDefaultImage() {
    return {
      type: 'image',
      id: `img_${Date.now()}_${Math.random()}`,
      src: '',
      width: 0,
      height: 0,
      position: {
        x: 0,
        y: 0,
        isAbsolute: false
      },
      rotation: 0,
      crop: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      },
      borders: {
        enabled: false,
        width: 0,
        color: '#000000',
        style: 'solid'
      },
      shadow: {
        enabled: false,
        blur: 0,
        offsetX: 0,
        offsetY: 0,
        color: '#000000',
        opacity: 0.3
      },
      locked: {
        position: false,
        width: true,
        height: true,
        crop: false
      }
    };
  }
}

module.exports = ExtractImage;
