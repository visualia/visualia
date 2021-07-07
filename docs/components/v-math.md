# v-math

v-math displays mathematical expressions.

#### Usage

Here are some simple math expressions:

```md
> <v-math>a = 100 \\\\ b = \frac{a}{10} = 10</v-math>
```

> <v-math>a = 100 \\\\ b = \frac{a}{10} = 10</v-math>

<p />

#### Dynamic values

To use the dynamic values in expressions, use [global variables](/utils/variables).

Lets assign <v-math>a</v-math> to variable and use `<v-slider />` to control it.

> <v-math>a = {{ v.a }} \\\\ \frac{ {{ v.a }} }{10} = {{ v.a / 10 }}</v-math>

<v-slider v-model="v.a" />

#### Syntax reference

Here are some references and examples how to express math in LaTeX / KaTeX format:

https://katex.org/docs/supported.html
https://en.wikibooks.org/wiki/LaTeX/Mathematics

#### Prior art

https://designstem.github.io/fachwerk/docs/#/f-math
https://visualia.github.io/visualia_original/#math
