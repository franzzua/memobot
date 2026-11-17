# Builds assets/duel-words.txt, the word list Word Duel accepts: lowercase hunspell en_US
# stems plus their -s plurals, 5 to 12 letters, no proper nouns. Run on a machine with
# hunspell-en installed:  python3 scripts/duel-dictionary.py
import re

words = set()
for line in open('/usr/share/hunspell/en_US.dic', encoding='utf-8', errors='ignore').read().split('\n')[1:]:
    stem, _, flags = line.partition('/')
    if not re.fullmatch(r'[a-z]{3,12}', stem):
        continue
    words.add(stem)
    if 'S' in flags:
        if re.search(r'(s|x|z|ch|sh)$', stem):
            words.add(stem + 'es')
        elif re.search(r'[^aeiou]y$', stem):
            words.add(stem[:-1] + 'ies')
        else:
            words.add(stem + 's')

# The bot banks and announces any listed word to students, so leave out profanity and slurs.
BLOCKED_STEMS = ('fuck', 'shit', 'cunt', 'nigg', 'bitch', 'whore', 'slut', 'fagg', 'faggot', 'dickhead',
                 'cocksuck', 'asshole', 'arsehole', 'twat', 'wank', 'bastard', 'piss', 'porn', 'dildo',
                 'rapist', 'boner', 'titties', 'titty', 'boobs', 'horny', 'skank', 'spunk')
BLOCKED_WORDS = {'dicks', 'cocks', 'pussy', 'pussies', 'rapes', 'raped', 'raping', 'penis', 'penises',
                 'vagina', 'vaginas', 'semen', 'sluts', 'homos', 'retard', 'retards', 'retarded'}
words = sorted(w for w in words if 5 <= len(w) <= 12
               and w not in BLOCKED_WORDS and not w.startswith(BLOCKED_STEMS))
open('assets/duel-words.txt', 'w').write('\n'.join(words) + '\n')
print(len(words), 'words')
