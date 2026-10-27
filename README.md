# Explore Worlds — Protótipo

Tower defense + side-scrolling shooter + exploração espacial, baseado no GDD em `Apresentação sem título.pdf`.

## Como rodar

Abra `index.html` direto no navegador (Chrome/Edge/Firefox). Não precisa de build nem de dependências.

Ou, com um servidor local:

```bash
python -m http.server 8137
```

e acesse http://localhost:8137. Use `?dev` na URL para carregar as ferramentas de teste (`Dev.rich()`, `Dev.unlockAll()`, `Dev.mission('pyros')`, `Dev.boss()`).

## Loop de jogo

1. **Mapa Estelar**: escolha um mundo. Cada mundo tem bioma, temperatura, gravidade, recursos e um chefe.
2. **Pouso**: a nave solta a **Broca Extratora**, que minera sozinha durante toda a missão.
3. **Preparação**: construa defesas e explore o mapa (veios de minério e cápsulas antigas).
4. **Ondas**: os inimigos vêm pela esquerda, pela direita ou pelos dois lados. Se a broca cair, a missão fracassa e você perde 50% do que coletou.
5. **Chefe**: Verme Colossal, Rainha da Colmeia, Titã Ancestral ou Soberano do Vazio (o chefe final).
6. **Extração**: volte à nave e use o **Fabricador** para criar armas, melhorias do traje, projetos de construção, motores de dobra e itens.
7. Libere os setores 2, 3 e 4 até chegar ao **Núcleo Primordial**.

## Controles

| Tecla | Ação |
|---|---|
| A / D | Mover |
| W / Espaço | Pular (segure no ar para usar o jetpack) |
| S | Descer de um Teto |
| Shift | Esquiva |
| Mouse | Mirar e atirar |
| Q / roda do mouse / 1-6 | Trocar de arma |
| B / Tab / botão direito | Modo construção (1-7 escolhe; botão direito desmonta) |
| E (segure) | Extrair veio, abrir cápsula, alternar a Torre de Gravidade |
| R (segure) | Reparar (gasta sucata) |
| G / H / F | Granada / Kit médico / Kit de reparo |
| Enter | Chamar a próxima onda (dá bônus de sucata) |
| Esc / P | Pausa · M: som |

### Celular / tablet

Jogue com o aparelho na horizontal (o jogo tenta entrar em tela cheia no primeiro toque).

- **Lado esquerdo da tela**: arraste para mover (puxe para baixo para descer de um Teto)
- **Lado direito da tela**: arraste para mirar; segurar atira
- Botões: **PULAR** (segure para o jetpack), **ESQUIVA**, **ARMA**, **USAR**, **REPARAR**, **GRANADA**, **CURA**, **KIT REP.**, **ONDA ▶** e **II** (pausa)
- **CONSTRUIR**: escolha a peça na barra e arraste e solte no mapa; **DESMONTAR** remove a construção sob o dedo

## Estrutura

- `js/core.js`: constantes, matemática, input e fonte bitmap
- `js/audio.js`: efeitos e música sintetizados (WebAudio)
- `js/sprites.js`: pixel art, brilhos e planetas procedurais
- `js/data.js`: recursos, biomas, mundos, armas, construções, inimigos e receitas (todo o balanceamento fica aqui)
- `js/mission.js`: fases da missão, ondas, construção e interações
- `js/player.js`, `enemies.js`, `bosses.js`, `buildings.js`, `projectiles.js`: entidades
- `js/background.js`: cenário em parallax, terreno e clima
- `js/starmap.js`, `js/ui.js`, `js/main.js`: mapa estelar, interface e loop principal
