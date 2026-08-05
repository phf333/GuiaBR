import { Capitulo } from '../guia.service';

export const CAPITULOS_DEFAULT: Capitulo[] = [
  {
    numero: 1,
    titulo: 'Princípios',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Alimentação diz respeito à ingestão de nutrientes, mas também aos alimentos que contêm e fornecem os nutrientes, a como alimentos são combinados entre si e preparados, a características do modo de comer e às dimensões culturais e sociais das práticas alimentares. Todos esses aspectos influenciam a saúde e o bem-estar.'
      },
      {
        tipo: 'fundamento',
        texto: 'Alimentação adequada e saudável deriva de sistema alimentar socialmente e ambientalmente sustentável. Recomendações sobre alimentação devem levar em conta o impacto das formas de produção e distribuição dos alimentos sobre a justiça social e a integridade do ambiente.'
      },
      {
        tipo: 'fundamento',
        texto: 'Guias alimentares ampliam a autonomia nas escolhas alimentares. O acesso a informações confiáveis sobre características e determinantes da alimentação adequada e saudável contribui para que pessoas, famílias e comunidades ampliem a autonomia para fazer escolhas alimentares e para que exijam o cumprimento do direito humano à alimentação adequada e saudável.'
      },
    ]
  },
  {
    numero: 2,
    titulo: 'A Escolha dos Alimentos',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Faça de alimentos in natura ou minimamente processados a base de sua alimentação. Alimentos in natura ou minimamente processados, em grande variedade e predominantemente de origem vegetal, são a base para uma alimentação nutricionalmente balanceada, saborosa, culturalmente apropriada e promotora de um sistema alimentar socialmente e ambientalmente sustentável.'
      },
      {
        tipo: 'fundamento',
        texto: 'Utilize óleos, gorduras, sal e açúcar em pequenas quantidades ao temperar e cozinhar alimentos e criar preparações culinárias. Desde que utilizados com moderação em preparações culinárias com base em alimentos in natura ou minimamente processados, óleos, gorduras, sal e açúcar contribuem para diversificar e tornar mais saborosa a alimentação sem torná-la nutricionalmente desbalanceada.'
      },
      {
        tipo: 'fundamento',
        texto: 'Limite o uso de alimentos processados, consumindo-os, em pequenas quantidades, como ingredientes de preparações culinárias ou como parte de refeições baseadas em alimentos in natura ou minimamente processados. Os ingredientes e métodos usados na fabricação de alimentos processados – como conservas de legumes, compota de frutas, queijos e pães – alteram de modo desfavorável a composição nutricional dos alimentos dos quais derivam.'
      },
      {
        tipo: 'fundamento',
        texto: 'Evite alimentos ultraprocessados. Devido a seus ingredientes, alimentos ultraprocessados – como biscoitos recheados, salgadinhos "de pacote", refrigerantes e macarrão "instantâneo" – são nutricionalmente desbalanceados. Por conta de sua formulação e apresentação, tendem a ser consumidos em excesso e a substituir alimentos in natura ou minimamente processados.'
      },
      {
        tipo: 'sabia_que',
        texto: 'Prefira sempre alimentos in natura ou minimamente processados e preparações culinárias a alimentos ultraprocessados. Ou seja: opte por água, leite e frutas no lugar de refrigerantes, bebidas lácteas e biscoitos recheados; não troque comida feita na hora por produtos que dispensam preparação culinária.'
      },
    ]
  },
  {
    numero: 3,
    titulo: 'Dos Alimentos à Refeição',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Arroz e feijão correspondem a quase um quarto da alimentação. A mistura de feijão com arroz aparece em quase todos os almoços selecionados. Combinados ao feijão ou outra leguminosa, os cereais constituem também fonte de proteína de excelente qualidade.'
      },
      {
        tipo: 'fundamento',
        texto: 'Verduras ou legumes estão presentes em todos os almoços exemplificados. Legumes e verduras são excelentes fontes de várias vitaminas e minerais e, portanto, muito importantes para a prevenção de deficiências de micronutrientes. Além de serem fontes de fibras, fornecem, de modo geral, muitos nutrientes em uma quantidade relativamente pequena de calorias.'
      },
      {
        tipo: 'fundamento',
        texto: 'Carnes vermelhas (de gado ou de porco) estão restritas a um terço das refeições apresentadas, priorizando-se cortes magros e preparações grelhadas ou assadas. Pelo menor conteúdo de gorduras e, em particular, pela alta proporção de gorduras saudáveis (gorduras insaturadas), os peixes, tanto quanto os legumes e verduras, são excelentes substitutos para as carnes vermelhas.'
      },
      {
        tipo: 'sabia_que',
        texto: 'A água é essencial para a manutenção da vida. A água pura (ou, como preferido por algumas pessoas, "temperada" com rodelas de limão ou folhas de hortelã) é a melhor opção para a ingestão de líquidos. Produtos como refrigerantes e vários tipos de bebidas adoçadas possuem alta proporção de água, mas contêm açúcar ou adoçantes artificiais e vários aditivos, razão pela qual não podem ser considerados fontes adequadas para hidratação.'
      },
    ]
  },
  {
    numero: 4,
    titulo: 'O Ato de Comer e a Comensalidade',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Procure fazer suas refeições diárias em horários semelhantes. Evite "beliscar" nos intervalos entre as refeições. Coma sempre devagar e desfrute o que está comendo, sem se envolver em outra atividade.'
      },
      {
        tipo: 'fundamento',
        texto: 'Procure comer sempre em locais limpos, confortáveis e tranquilos e onde não haja estímulos para o consumo de quantidades ilimitadas de alimentos. Telefones celulares sobre a mesa e aparelhos de televisão ligados devem ser evitados. Também é importante evitar comer na mesa de trabalho, comer em pé ou andando ou comer dentro de carros ou de transportes públicos.'
      },
      {
        tipo: 'fundamento',
        texto: 'Sempre que possível, prefira comer em companhia, com familiares, amigos ou colegas de trabalho ou escola. Procure compartilhar também as atividades domésticas que antecedem ou sucedem o consumo das refeições.'
      },
    ]
  },
  {
    numero: 5,
    titulo: 'A Compreensão e a Superação de Obstáculos',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Procure fazer compras de alimentos em mercados, feiras livres e feiras de produtores e em outros locais que comercializam variedades de alimentos in natura ou minimamente processados, dando preferência a alimentos orgânicos da agroecologia familiar. Evite fazer compras em locais que só vendem alimentos ultraprocessados.'
      },
      {
        tipo: 'fundamento',
        texto: 'Embora legumes, verduras e frutas possam ter preço superior ao de alguns alimentos ultraprocessados, o custo total de uma alimentação baseada em alimentos in natura ou minimamente processados ainda é menor no Brasil do que o custo de uma alimentação baseada em alimentos ultraprocessados. Dê sempre preferência a legumes, verduras e frutas da estação e produzidos localmente.'
      },
      {
        tipo: 'fundamento',
        texto: 'Desenvolva, exercite e partilhe suas habilidades culinárias. Se você não tem habilidades culinárias – e isso vale para homens e mulheres –, procure adquiri-las. Para isso, converse com as pessoas que sabem cozinhar, peça receitas a familiares, amigos e colegas, leia livros, consulte a internet, eventualmente faça cursos e... comece a cozinhar!'
      },
      {
        tipo: 'fundamento',
        texto: 'Para reduzir o tempo dedicado à aquisição de alimentos e ao preparo de refeições, planeje as compras, organize a despensa, defina com antecedência o cardápio da semana, aumente o seu domínio de técnicas culinárias e faça com que todos os membros de sua família compartilhem da responsabilidade pelas atividades domésticas relacionadas à alimentação.'
      },
      {
        tipo: 'sabia_que',
        texto: 'A publicidade de alimentos ultraprocessados domina os anúncios comerciais de alimentos, frequentemente veicula informações incorretas ou incompletas sobre alimentação e atinge, sobretudo, crianças e jovens. Esclareça as crianças e os jovens de que a função da publicidade é essencialmente aumentar a venda de produtos, e não informar ou, menos ainda, educar as pessoas.'
      },
    ]
  },
  {
    numero: 6,
    titulo: 'Dez Passos para uma Alimentação Adequada e Saudável',
    status: 'active',
    cards: [
      {
        tipo: 'fundamento',
        texto: 'Fazer de alimentos in natura ou minimamente processados a base da alimentação. Em grande variedade e predominantemente de origem vegetal, alimentos in natura ou minimamente processados são a base ideal para uma alimentação nutricionalmente balanceada, saborosa, culturalmente apropriada e promotora de um sistema alimentar socialmente e ambientalmente sustentável.'
      },
      {
        tipo: 'fundamento',
        texto: 'Utilizar óleos, gorduras, sal e açúcar em pequenas quantidades ao temperar e cozinhar alimentos e criar preparações culinárias. Utilizados com moderação em preparações culinárias com base em alimentos in natura ou minimamente processados, óleos, gorduras, sal e açúcar contribuem para diversificar e tornar mais saborosa a alimentação sem torná-la nutricionalmente desbalanceada.'
      },
      {
        tipo: 'fundamento',
        texto: 'Limitar o consumo de alimentos processados. Os ingredientes e métodos usados na fabricação de alimentos processados – como conservas de legumes, compota de frutas, pães e queijos – alteram de modo desfavorável a composição nutricional dos alimentos dos quais derivam.'
      },
      {
        tipo: 'fundamento',
        texto: 'Evitar o consumo de alimentos ultraprocessados. Devido a seus ingredientes, alimentos ultraprocessados – como biscoitos recheados, "salgadinhos de pacote", refrigerantes e "macarrão instantâneo" – são nutricionalmente desbalanceados. Por conta de sua formulação e apresentação, tendem a ser consumidos em excesso e a substituir alimentos in natura ou minimamente processados.'
      },
      {
        tipo: 'fundamento',
        texto: 'Comer com regularidade e atenção, em ambientes apropriados e, sempre que possível, com companhia. Procure fazer suas refeições em horários semelhantes todos os dias e evite "beliscar" nos intervalos entre as refeições. Coma sempre devagar e desfrute o que está comendo, sem se envolver em outra atividade.'
      },
      {
        tipo: 'fundamento',
        texto: 'Fazer compras em locais que ofertem variedades de alimentos in natura ou minimamente processados. Procure fazer compras de alimentos em mercados, feiras livres e feiras de produtores e outros locais que comercializam variedades de alimentos in natura ou minimamente processados.'
      },
      {
        tipo: 'fundamento',
        texto: 'Desenvolver, exercitar e partilhar habilidades culinárias. Se você tem habilidades culinárias, procure desenvolvê-las e partilhá-las, principalmente com crianças e jovens, sem distinção de gênero. Se você não tem habilidades culinárias – e isso vale para homens e mulheres –, procure adquiri-las.'
      },
      {
        tipo: 'fundamento',
        texto: 'Planejar o uso do tempo para dar à alimentação o espaço que ela merece. Planeje as compras de alimentos, organize a despensa doméstica e defina com antecedência o cardápio da semana. Divida com os membros de sua família a responsabilidade por todas as atividades domésticas relacionadas ao preparo de refeições.'
      },
      {
        tipo: 'fundamento',
        texto: 'Dar preferência, quando fora de casa, a locais que servem refeições feitas na hora. No dia a dia, procure locais que servem refeições feitas na hora e a preço justo. Restaurantes de comida a quilo podem ser boas opções, assim como refeitórios que servem comida caseira em escolas ou no local de trabalho.'
      },
      {
        tipo: 'sabia_que',
        texto: 'Ser crítico quanto a informações, orientações e mensagens sobre alimentação veiculadas em propagandas comerciais. Lembre-se de que a função essencial da publicidade é aumentar a venda de produtos, e não informar ou, menos ainda, educar as pessoas.'
      },
    ]
  },
];
