import type { Dict } from './no';

export const en: Dict = {
  htmlLang: 'en',
  ogLocale: 'en_GB',
  langName: 'English',

  meta: {
    // Titles and descriptions for search engines and share cards. One per
    // page, with the words people search for (embarkation ladder, lifeboat
    // ladder, boat ladder) early. Only facts that are also on the pages.
    keywords: [
      'embarkation ladder',
      'lifeboat ladder',
      'boat ladder',
      'lightweight ladder',
      'maritime ladder',
      'Argostep',
      'NorthWest Coast',
      'Norwegian Maritime Authority',
      'ISO 799-1:2019',
      'fishing vessel',
      'boarding',
    ],
    home: {
      title: 'Argostep – lightweight embarkation ladder | NorthWest Coast',
      description:
        'Argostep is a lightweight, modular embarkation and lifeboat ladder in glass-fibre reinforced plastic, from 2 to 15 metres. Approved by the Norwegian Maritime Authority. Made in Norway.',
      // Also printed in the share image (app/og/[lang]/route.tsx): keep it short.
      ogDescription: 'Lightweight, modular ladder for vessels. Certified to ISO 799-1:2019. Made in Norway.',
    },
    produkt: {
      title: 'Argostep lifeboat ladder – modular, 2–15 m | NorthWest Coast',
      description:
        'The Argostep lifeboat and embarkation ladder in glass-fibre reinforced plastic: modular, lightweight and strong. Certified to ISO 799-1:2019, approved by the Norwegian Maritime Authority. 2 to 15 metres.',
    },
    galleri: {
      title: 'Pictures of the Argostep ladder in use | NorthWest Coast',
      description:
        'See the Argostep lifeboat ladder in pictures – the product, storage cabinets and the ladder in daily use along the Norwegian coast.',
    },
    nyheter: {
      title: 'News about maritime ladders | NorthWest Coast',
      description: 'News, cases and regulations for maritime ladders from NorthWest Coast.',
    },
    vedlikehold: {
      title: 'Ladder maintenance | NorthWest Coast',
      description:
        'See how to maintain the Argostep lifeboat ladder and log completed maintenance for your vessel – with an email receipt as documentation.',
    },
    faq: {
      title: 'Argostep ladder – questions and answers | NorthWest Coast',
      description:
        'Answers to common questions about the Argostep lifeboat ladder: approval, lengths, material, service life, mounting, delivery, spare parts and service.',
    },
    kalkulator: {
      title: 'Ladder calculator – find the right length | NorthWest Coast',
      description:
        'Work out which Argostep lifeboat ladder your vessel needs from freeboard and mounting point – and order the right length directly.',
    },
    bestill: {
      title: 'Order the Argostep ladder – lengths and prices | NorthWest Coast',
      description:
        'Order the Argostep lifeboat ladder: choose a length between 2 and 15 metres and a storage cabinet, see the indicative price excl. VAT and view the ladder in 3D as you configure it.',
    },
    omOss: {
      title: 'About us – maritime ladders from Sunnmøre | NorthWest Coast',
      description:
        'NorthWest Coast was founded by three entrepreneurs from Ålesund and develops maritime safety products. The Argostep ladder is made in Sunnmøre, Norway, with components from local suppliers.',
    },
    produkter: {
      title: 'Ladders, storage cabinets and spare parts | NorthWest Coast',
      description:
        'The Argostep embarkation and lifeboat ladder with standard lengths and indicative prices, storage cabinets, spare parts and service from NorthWest Coast.',
    },
    leider3d: {
      title: 'Argostep ladder in 3D – interactive model | NorthWest Coast',
      description:
        'Interactive 3D model of the Argostep ladder. Rotate, zoom and explore it in detail – and view it in AR on your phone.',
    },
  },

  nav: {
    produkt: 'Product',
    galleri: 'Gallery',
    nyheter: 'News',
    vedlikehold: 'Maintenance',
    faq: 'FAQ',
    cta: 'Order now',
    menu: 'Menu',
    drawerCta: 'Order now →',
    switchTo: 'Bytt til norsk',
  },

  hero: {
    h1Suffix: 'lifeboat ladder',
    eyebrow: 'The future of boarding',
    desc: 'A lightweight, modular ladder designed around safety. Approved by the Norwegian Maritime Authority. Made in Sunnmøre, Norway.',
    ctaOrder: 'Order now →',
    ctaHow: '▶ See how it works',
    statLengths: 'Lengths',
    statIso: '799-1:2019',
    statMade: 'Made in Norway',
  },

  features: {
    handling: {
      title: 'Easy Handling',
      desc: 'Considerably lighter than wooden ladders. The click coupling makes deploying and retrieving quick.',
    },
    storage: {
      title: 'Compact Storage',
      desc: 'Stored in its own weatherproof cabinet – protects against wear and saves deck space.',
    },
    lifetime: {
      title: 'Long Service Life',
      desc: 'Replaceable components in reinforced plastic – change a single step, not the whole ladder.',
    },
    custom: {
      title: 'Made to Measure',
      desc: 'Adapted to your specifications. A flexible solution from 2 to 15 metres.',
    },
  },

  how: {
    label: 'See it in action',
    title: 'How Argostep Works',
    sub: 'Argostep makes boarding simpler. Compared with traditional wooden ladders, Argostep is lighter, stronger and more durable – thanks to glass-fibre reinforced plastic.',
    playLabel: 'Play video',
    steps: {
      modular: {
        title: 'Modular System',
        desc: 'A simple click coupling for every step. Maintenance without special tools – replace a single step when needed.',
      },
      material: {
        title: 'Material Choice',
        desc: 'High-quality glass-fibre reinforced plastic for steps and fittings. Straps securely fastened to every step – low weight and high strength.',
      },
      storage: {
        title: 'Storage Solution',
        desc: 'A dedicated cabinet protected from wind and weather. Extends service life and eliminates wear from exposure.',
      },
      deploy: {
        title: 'Rapid Deployment',
        desc: 'Click-on extenders give stable support. Mounting and dismounting is done quickly by one person.',
      },
    },
  },

  gallery: {
    pageSub: 'From product to practice – see the ladder from every angle and in daily use along the Norwegian coast.',
    label: 'Product gallery',
    title: 'Argostep in pictures',
    sub: 'From product to practice – see Argostep from every angle and in daily use along the Norwegian coast.',
    seeAll: 'See all pictures →',
    zoomHint: 'Click the images to enlarge.',
    enlargedAlt: 'Enlarged image',
    close: 'Close',
    tabs: {
      all: 'All',
      ladder: 'Ladder',
      storage: 'Storage',
      inUse: 'In use',
      references: 'References',
    },
    images: {
      inUse: { alt: 'Ladder in use', label: 'Boarding from the ship’s side' },
      mounted: { alt: 'Mounted on a vessel', label: 'Mounted on a passenger vessel' },
      practice: { alt: 'Lifeboat ladder in use', label: 'Lifeboat ladder – test drill' },
      full: { alt: 'Fully deployed', label: 'Fully Deployed' },
      folded: { alt: 'Folded', label: 'Ultra-compact – Folded' },
      folded2: { alt: 'Ladder folded', label: 'Compact when folded' },
      cabinet: { alt: 'Storage cabinet', label: 'Storage cabinet' },
      cabinetOpen: { alt: 'Open case', label: 'Cabinet interior' },
      case1: { alt: 'Case on board', label: 'Compact storage on board' },
      case2: { alt: 'Argostep case', label: 'Argostep case on deck' },
      case3: { alt: 'Case detail', label: 'Case – detail' },
      case4: { alt: 'Case on the quay', label: 'Ready for use at the quay' },
      veidar: { alt: 'M/S Veidar', label: 'Installed on board M/S Veidar' },
      tindskjaer: { alt: 'M/S Tindskjær', label: 'M/S Tindskjær' },
      skar1: { alt: 'M/S Skår Senior', label: 'M/S Skår Senior' },
      skar2: { alt: 'M/S Skår Senior installation', label: 'Argostep on M/S Skår Senior' },
      skar3: { alt: 'M/S Skår Senior detail', label: 'Detail – M/S Skår Senior' },
    },
  },

  viewer: {
    label: 'Interactive 3D model',
    title: 'See the Ladder in 3D',
    sub: 'Rotate, zoom and explore Argostep in detail. Click and drag to rotate – scroll to zoom.',
    modelAlt: 'Argostep 3D model',
    fullscreen: 'View in full screen',
    exitFullscreen: 'Exit full screen',
    infos: {
      deployed: {
        title: 'Fully Deployed',
        desc: 'See the ladder as it looks ready for use – with every step and strap in place.',
      },
      detail: {
        title: 'True-to-Detail Model',
        desc: 'Glass-fibre reinforced steps, click fittings and side straps shown in detail.',
      },
      scale: {
        title: 'Correctly Scaled',
        desc: 'The model shows the standard 7-step variant. Can you find the right length for your vessel?',
      },
    },
  },

  certs: {
    label: 'Safety first',
    title: 'Certified for Safety',
    sub: 'Argostep is built to the highest standards – and we always aim to exceed them.',
    cards: {
      iso: { title: 'ISO 799-1:2019', sub: 'Certified for ships and marine technology' },
      nma: {
        title: 'Norwegian Maritime Authority',
        sub: 'Approved for Norwegian vessels under 15 metres',
      },
      solas: { title: 'SOLAS compatible', sub: 'Meets international safety requirements' },
    },
    vesselsLabel: 'Suitable for',
    vessels: {
      fishing: 'Fishing vessels under 15 m',
      service: 'Service vessels under 15 m',
      cargo: 'Smaller cargo ships',
      passenger: 'Passenger vessels',
    },
  },

  testimonials: {
    label: 'Customer feedback',
    title: 'What our customers say',
    sub: 'Choose Argostep and join our many satisfied customers along the Norwegian coast.',
    quotes: {
      tindskjaer:
        'We got our approval! Very pleased with this. Also excellent for small jobs along the ship’s side.',
      rostein: 'Easy to mount and takes up minimal space. Highly recommended!',
      solvtrans: 'Solid quality and a well-thought-out design. We are very happy with the product.',
    },
  },

  news: {
    label: 'Latest news',
    title: 'From the Blog',
    sub: 'Keep up to date with news, cases and regulations for maritime ladders.',
    readFull: 'Read the full article →',
    seeAll: 'See all posts →',
    readMore: 'Read more →',
    back: '← Back to news',
    pageLabel: 'From the blog',
    pageTitle: 'Latest news',
  },

  faq: {
    contactLabel: 'Contact',
    label: 'Questions & Answers',
    title: 'Frequently asked questions',
    sub: 'Haven’t found your answer? Contact us directly – we’re happy to help.',
    contactCta: 'Get in touch →',
    allCta: 'See all questions →',
    pageLabel: 'Help & Support',
    pageSub: 'Find answers to the most common questions about Argostep.',
    searchPlaceholder: 'Search questions and answers…',
    noMatch: 'No questions match your search.',
    contactHeading: 'Haven’t found your answer?',
    contactSub: 'Contact us directly – we’re happy to help.',
    questionLabel: 'Question *',
    questionPlaceholder: 'What would you like to know?',
    submit: 'Send question →',
    categories: {
      all: 'All',
      product: 'Product',
      certification: 'Certification',
      installation: 'Installation',
      delivery: 'Delivery',
    },
    items: {
      approved: {
        q: 'Is the ladder approved for Norwegian ships?',
        a: 'Yes. The Argostep embarkation and lifeboat ladder is tested and certified to ISO 799-1:2019 and approved by the Norwegian Maritime Authority for Norwegian vessels.',
      },
      lengths: {
        q: 'Which lengths are available?',
        a: 'The Argostep Lifeboat Ladder comes in standard lengths from 2 to 15 metres. Get in touch if you need something else and we will put together a package for you.',
      },
      lifetime: {
        q: 'How long does a ladder last?',
        a: 'It is designed for a long service life with replaceable components. Storing it in a cabinet from Northwestcoast increases that life considerably.',
      },
      mounting: {
        q: 'How do I mount the ladder?',
        a: 'Argostep is designed for easy mounting and dismounting without special tools. The ladder is mounted the same way as a traditional ladder.',
      },
      delivery: {
        q: 'What is the delivery time for Argostep?',
        a: 'Delivery time varies with the specification. Contact us for an exact quote and an estimated delivery time for your vessel.',
      },
      material: {
        q: 'What material is the ladder made of?',
        a: 'The steps and fittings are injection-moulded glass-fibre reinforced plastic – a material that combines low weight, high strength and excellent corrosion resistance in saltwater environments.',
      },
      weight: {
        q: 'What does a standard Argostep weigh?',
        a: 'You will find all the weights for the Argostep ladder under Order now.',
      },
      selfMount: {
        q: 'Can I mount the ladder myself?',
        a: 'Yes, Argostep is built for self-installation. The included mounting instructions and the click coupling system make it possible to mount the ladder without a professional.',
      },
      parts: {
        q: 'Do you offer spare parts and service?',
        a: 'Yes. One of the main advantages of Argostep is the modular system – individual steps and components can be ordered separately. Contact us for spare parts or a service agreement.',
      },
    },
  },

  contact: {
    label: 'Contact us',
    title: 'Get in Touch',
    sub: 'Ask for a quote tailored to your vessel – we reply quickly.',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    addressValue: 'PO Box 79, 6281 Søvik, Norway',
    orgNo: 'Company no.',
    founders: 'The founders',
    form: {
      name: 'Name *',
      namePlaceholder: 'Your name',
      email: 'Email *',
      emailPlaceholder: 'you@company.com',
      phone: 'Phone',
      phonePlaceholder: '+47 000 00 000',
      company: 'Vessel/Company',
      companyPlaceholder: 'Vessel/Company',
      product: 'Product',
      productOptions: {
        ladder: 'Argostep Lifeboat Ladder',
        cabinet: 'Storage cabinet',
        parts: 'Spare parts',
      },
      message: 'Message',
      messagePlaceholder: 'Tell us about your needs (ladder length, vessel type, etc.)',
      submit: 'Send Enquiry →',
      sending: 'Sending…',
      success: '✓ Thank you! We will be in touch shortly.',
    },
  },

  newsletter: {
    label: 'Newsletter',
    title: 'Sign up for our newsletter',
    sub: 'The latest on maritime safety, Argostep and Norwegian maritime regulations.',
    placeholder: 'Your email address...',
    submit: 'Sign up',
    sending: 'Sending…',
    success: '✓ You are signed up!',
  },

  footer: {
    tagline: 'High-quality maritime safety equipment. Made in Sunnmøre, Norway.',
    products: 'Products',
    ladder: 'Argostep Lifeboat Ladder',
    parts: 'Spare parts',
    company: 'Company',
    about: 'About us',
    certifications: 'Certifications',
    orderList: 'Order / price list',
    maintenance: 'Maintenance',
    news: 'News',
    privacy: 'Privacy',
    contact: 'Contact',
    faq: 'FAQ',
    office: 'Office',
    addressLine1: 'PO Box 79',
    addressLine2: '6281 Søvik, Norway',
    orgNo: 'Company no.: 998 196 159',
    rights: '© 2026 Northwestcoast AS. All rights reserved.',
    madeWith: 'Designed in Ålesund',
  },

  product: {
    answerTitle: 'What is Argostep?',
    answerBody: 'Argostep is a lightweight, modular embarkation and lifeboat ladder in glass-fibre reinforced plastic from NorthWest Coast. It is tested to ISO 799-1:2019, approved by the Norwegian Maritime Authority for Norwegian vessels under 15 metres, and comes in standard lengths from 2 to 15 metres. Worn steps can be replaced individually, and the ladder is mounted without special tools.',
    lengthTitle: 'Which length does my vessel need?',
    lengthBody: 'The length depends on the freeboard, the height up to the mounting point and how far the ladder must reach below the waterline. Enter your measurements in the ladder calculator to get a recommended length and order it directly.',
    lengthCta: 'Open the ladder calculator →',
    label: 'Product',
    title: 'Argostep Lifeboat Ladder',
    sub: 'The lightweight, modular maritime ladder – built for safe boarding along the Norwegian coast. Certified, durable and tailored to your vessel.',
    introLabel: 'Maritime ladder',
    introTitle: 'Built for vessels on the Norwegian coast',
    introSub: 'The Argostep Lifeboat Ladder is considerably lighter than traditional wooden ladders and far more durable. The modular click system makes deploying and retrieving fast – and worn steps can be replaced individually instead of the whole ladder.',
    fullAlt: 'Argostep Lifeboat Ladder at full length',
    inUseAlt: 'Argostep Lifeboat Ladder in use',
    specs: {
      lengths: { key: 'Lengths', val: '2 – 15 metres (standard)' },
      material: { key: 'Material', val: 'Glass-fibre reinforced plastic' },
      certification: { key: 'Certification', val: 'ISO 799-1:2019' },
      approval: { key: 'Approval', val: 'Norwegian Maritime Authority' },
      system: { key: 'System', val: 'Modular click coupling' },
      maintenance: { key: 'Maintenance', val: 'Replaceable individual steps' },
    },
    call: 'Call +47 904 07 341',
    fitLabel: 'Customisation',
    fitTitle: 'Tailored to your vessel',
    fitSub: 'The Argostep Lifeboat Ladder comes in standard lengths from 2 to 15 metres. Get in touch if you need something else and we will put together a package for you – including storage cabinets and spare parts.',
    bandLabel: 'Ready to order?',
    bandTitle: 'Secure your vessel with Argostep',
    bandSub: 'Tell us about your vessel and we will put together the right ladder solution and send you a quote quickly.',
  },

  order: {
    errorSend: 'We could not send the order. Please call +47 904 07 341.',
    errorRetry: 'We could not send the order. Please try again.',
    checkoutSub: 'We confirm price and delivery time – no obligation.',
    sendRequest: 'Send request →',
    sendRequestValue: (amount: string) => `Send request · ${amount} kr →`,
    confirmRequest: (what: string) => `✓ Thank you! We have received your request for ${what} and sent you a confirmation by email. We will be in touch with a final quote and delivery time.`,
    preferPhone: 'Prefer to talk to someone?',
    callUs: 'Call +47 904 07 341',
    vesselCompany: 'Vessel/Company',
    notesPlaceholderBase: 'Preferred delivery time, installation, special requirements…',
    onRequest: 'Price on request',
    onRequestNote: 'Lines marked “price on request” are quoted separately and are not included in the total.',
    onRequestShort: 'On request',
    // Half-metre lengths and cabinets without a ladder (order page).
    otherLength: 'Other length, e.g. 4.5 m',
    otherLengthPick: 'Choose length',
    otherLengthHint: 'Half-metre lengths are made to order. You get a quote with price and delivery time.',
    customLabel: 'Custom length',
    customName: (length: string) => `Argostep – ${length} m (custom length)`,
    cabinetOnlyTitle: 'Storage cabinet without a ladder',
    cabinetOnlySub: 'Already have a ladder? You can order the cabinet on its own.',
    cabinetOnlyShow: 'Show cabinets',
    cabinetOnlyHide: 'Hide cabinets',
    fitsLadder: (range: string) => `Fits ${range} m ladders`,
    withoutLadder: 'Without ladder',
    add: 'Add',
    unitCount: (ladders: number, cabinets: number) =>
      [
        ladders > 0 ? `${ladders} ${ladders === 1 ? 'ladder' : 'ladders'}` : '',
        cabinets > 0 ? `${cabinets} ${cabinets === 1 ? 'cabinet' : 'cabinets'}` : '',
      ].filter(Boolean).join(' and '),
    label: 'Ordering',
    title: 'Order your Argostep',
    sub: 'Configure the ladder for your vessel. Choose a length between 2 and 15 metres plus accessories – and see it in 3D as you go. Half-metre lengths and storage cabinets without a ladder can be ordered here too.',
    configureLabel: 'Configure your ladder',
    productNo: 'Product no.',
    steps: 'steps',
    length: 'Length',
    meters: 'metres',
    accessories: 'Accessories',
    cabinet: 'Storage cabinet',
    selected: 'Selected',
    quantity: 'Quantity',
    fewer: 'Fewer',
    more: 'More',
    remove: 'Remove',
    addToOrder: 'Add to order',
    yourOrder: 'Your order',
    total: 'Total',
    emptyHint: 'Add a ladder or a cabinet',
    ladderCount: 'ladder(s)',
    rotateHint: 'Drag to rotate',
    leadTitle: 'Where should we send the quote?',
    leadSub: 'We confirm price and delivery time – normally within one business day.',
    submit: 'Send order →',
    sending: 'Sending…',
    confirm:
      '✓ Thank you! We have received your order. You will get a receipt by email, and we will be in touch with confirmation and delivery time – normally within one business day.',
    note: 'Prices are indicative and exclude VAT. The final quote is confirmed after contact.',
    fields: {
      name: 'Name *',
      namePlaceholder: 'Your name',
      email: 'Email *',
      emailPlaceholder: 'you@company.com',
      phone: 'Phone',
      phonePlaceholder: '+47 000 00 000',
      company: 'Vessel/Company',
      companyPlaceholder: 'e.g. MS Havbris',
      imo: 'IMO no.',
      imoPlaceholder: 'e.g. 9074729',
      notes: 'Comment',
      notesPlaceholder: 'Installation, preferred delivery time or other needs (optional)',
    },
  },

  calculator: {
    label: 'Ladder calculator',
    title: 'Find the right ladder for your vessel',
    sub: 'Enter the measurements from your vessel and we work out the length you need – then you can order the right ladder straight away.',
    navLabel: 'Calculator',

    vesselHeading: 'The vessel',
    searchLabel: 'Find the vessel',
    searchPlaceholder: 'Name, call sign, registration mark or IMO',
    searchHint:
      'The search uses the Norwegian Directorate of Fisheries vessel register, which only lists fishing vessels. For any other vessel, fill in the fields below yourself.',
    search: {
      loading: 'Searching …',
      empty: 'No vessels found. The register only lists fishing vessels – fill in the details yourself.',
      unavailable: 'The vessel register is not responding right now. Fill in the details yourself.',
      count: '{n} results. Use the arrow keys and Enter to choose.',
      owner: 'Owner',
    },
    registerName: 'the Norwegian Directorate of Fisheries vessel register',
    fetchedCheck: 'Check the figures. Every field can be changed.',
    fetchedNoWidth: 'The register has no beam for this vessel. Enter it yourself.',
    vesselName: 'Vessel name',
    vesselNamePlaceholder: 'e.g. MS Havbris',
    imo: 'IMO no.',
    imoPlaceholder: 'e.g. 9074729',
    imoInvalid: 'This IMO number does not look right (the check digit does not match). Please check you typed it correctly.',
    imoValid: 'Valid IMO number',
    autofilled: 'Details fetched from',
    imoHelp: 'IMO 7',
    vesselType: 'Vessel type',
    vesselTypeOther: 'Other vessel',
    loa: 'Length overall (LOA)',
    loaHelp: 'Only used to check which approval applies.',

    measureHeading: 'Measurements',
    freeboard: 'Freeboard to embarkation deck',
    freeboardHelp:
      'Vertical height from the waterline up to the deck where the ladder is deployed. Use the lightest seagoing condition – that gives the greatest freeboard.',
    mountHeight: 'Height from deck to mounting point',
    mountHeightHelp: 'Set 0 if the ladder is fastened at deck level. Otherwise the height up to the rail or bulwark.',
    beam: 'Beam of the vessel',
    beamHelp:
      'Greatest breadth. Filled in when you pick the vessel in the search, or you enter it yourself. Used to work out the extension below the waterline.',
    margin: 'Extension below the waterline',
    marginFormula: (beam: string, deg: number, margin: string) => `Beam ${beam} m ÷ 2 × tan ${deg}° = ${margin} m`,
    marginNoBeam: (deg: number) =>
      `Enter the beam and the extension is worked out for a ${deg}° heel. Until then the figure below is used.`,
    marginOverride: 'Set the extension yourself',
    marginManual: 'Extension set by hand',
    marginManualHelp: 'Use this when your class society or flag state requires something other than the calculation.',
    marginComputed: (margin: string) => `Worked out from the beam: ${margin} m.`,
    marginHelp: (deg: number) =>
      `The extension lets the ladder reach the water even when the vessel heels ${deg}°. The calculation assumes straight ship sides and is an assumption, not a figure from the regulations.`,
    metres: 'm',

    resultHeading: 'Result',
    requiredLength: 'Required length',
    breakdown: 'Calculation',
    breakdownFreeboard: 'Freeboard',
    breakdownMount: 'Mounting point above deck',
    breakdownMargin: 'Extension below the waterline',
    breakdownManual: 'set by hand',
    breakdownNoBeam: 'beam not entered',
    recommended: 'Recommended ladder',
    chosen: 'Chosen ladder',
    slack: (metres: string) => `${metres} m longer than required`,
    steps: 'steps',
    productNo: 'Product no.',
    emptyState: 'Enter the freeboard and we will find the right length.',

    tooLongTitle: 'Beyond standard lengths',
    tooLongBody:
      'The requirement exceeds the longest standard ladder of 15 metres. Get in touch and we will put together a solution for your vessel.',
    atMinimumNote: 'The requirement is covered by the shortest ladder in the range.',
    loaNote:
      'The Norwegian Maritime Authority approval described here applies to vessels under 15 metres. Get in touch and we will confirm what applies to your vessel.',
    belowRequiredNote: 'This length is shorter than the calculation requires.',

    halfName: (length: string) => `Argostep – ${length} m`,
    halfMeta: 'Half-metre length – made on request',
    halfOfferTitle: (half: string) => `Alternative: ${half} m on request`,
    halfOffer: (half: string, standard: string) =>
      `${half} m also covers the requirement and is shorter than the ${standard} m standard ladder. Half-metre lengths are made on request and have no list price.`,
    halfChoose: (half: string) => `Choose ${half} m`,
    useRecommended: (length: string) => `Use the recommended length (${length} m)`,
    onRequestTag: 'on request',

    chooseLength: 'Choose the length yourself',
    chooseLengthHelp: 'The recommendation is selected automatically. You can override it here. Half-metre lengths are made on request.',
    cabinet: 'Storage cabinet',
    cabinetWish: 'Storage cabinet wanted',
    cabinetOnRequest: 'On request',
    quantity: 'Number of ladders',
    quantityHelp: 'One per embarkation station.',
    total: 'Total',
    priceNote: 'Prices are indicative and exclude VAT. The final quote is confirmed after contact.',

    disclaimer:
      'This calculator is a sizing aid – not a certificate of compliance. Final requirements for length and installation are confirmed by your class society, flag state or the Norwegian Maritime Authority. We go through the measurements with you before any order is confirmed.',

    orderHeading: 'Order this ladder',
    requestHeading: 'Ask for a price on this ladder',
    requestNote: 'This length has no list price. We reply with price and delivery time.',
    orderSub: 'We send your calculation along with the order so we can double-check the measurements before confirming.',
    submit: 'Send order →',
    sending: 'Sending…',
    confirm:
      '✓ Thank you! We have received your order together with your calculation. You will get a receipt by email and we will be in touch with confirmation – normally within one business day.',
    confirmRequest:
      '✓ Thank you! We have received your request together with your calculation. You will get a receipt by email and we will be in touch with price and delivery time – normally within one business day.',

    diagram: {
      heading: 'How the length is worked out',
      intro: (deg: number) =>
        `The ladder follows the ship's side from the mounting point down. The extension below the waterline means it still reaches the water when the vessel heels ${deg}°.`,
      exampleTag: 'Example',
      exampleNote: (fields: string) => `The drawing uses example figures for ${fields} until you have entered your own.`,
      exampleFreeboard: 'freeboard',
      exampleMount: 'mounting point',
      exampleBeam: 'beam',
      and: 'and',
      beam: 'Beam (B)',
      freeboard: 'Freeboard (F)',
      mount: 'Mounting point (h)',
      margin: 'Extension',
      ladder: 'Ladder',
      reach: 'Lower end at the surface',
      key: 'B = beam of the vessel · F = freeboard to embarkation deck · h = height from deck to mounting point',
      play: 'Show heel',
      stop: 'Stop',
      reset: 'Upright',
      angle: 'Heel angle',
      statusUpright: (depth: string) => `With no heel, the lower end of the ladder is ${depth} m below the surface.`,
      statusBelow: (deg: number, depth: string) => `At ${deg}° heel, the lower end is ${depth} m below the surface.`,
      statusAt: (deg: number) => `At ${deg}° heel, the lower end just reaches the surface.`,
      statusAbove: (deg: number, gap: string) => `At ${deg}° heel, the ladder ends ${gap} m above the surface.`,
      alt: (v: { beam: string; freeboard: string; mount: string; margin: string; ladder: string; deg: number }) =>
        `Cross-section of the vessel seen from ahead. Beam ${v.beam} m, freeboard ${v.freeboard} m, mounting point ${v.mount} m above deck and extension below the waterline ${v.margin} m. The ladder is ${v.ladder} m and follows the ship's side from the mounting point down. Heel ${v.deg}°.`,
    },
  },

  maintenance: {
    maxImages: (n: number) => `Max ${n} photos per report.`,
    tooLarge25: (fileName: string) => `The image “${fileName}” is too large (max 25 MB).`,
    processing: 'Processing…',
    saving: 'Saving report…',
    uploadingImage: (i: number, n: number) => `Uploading photo ${i} of ${n}…`,
    finishing: 'Finishing…',
    emailPlaceholderReceipt: 'For a receipt you can show at inspection',
    partialWarning: 'Note: not all photos were uploaded – probably poor coverage. The report itself is registered. Feel free to send the photos to',
    compressHint: 'Photos are compressed automatically before upload, so they go quickly even with poor coverage on board.',
    label: 'Maintenance',
    title: 'Ladder maintenance',
    sub: 'Log completed maintenance for your vessel – and get an email receipt you can use as documentation at inspection.',
    videoTitle: 'Maintenance of the Argostep lifeboat ladder',
    videoSoon: 'The maintenance video is coming soon',
    videoFallback: 'Need guidance or spare parts now? Call',
    videoFallbackMid: 'or send an email to',
    videoFallbackEnd: '– we are happy to help.',
    formTitle: 'Log maintenance',
    formSub: 'Fill in the details below and feel free to attach photos of the ladder.',
    name: 'Name *',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    boat: 'Vessel name *',
    boatPlaceholder: 'e.g. MS Havbris',
    imo: 'IMO no.',
    imoPlaceholder: 'e.g. 9074729',
    serial: 'Ladder serial number *',
    serialPlaceholder: 'e.g. ARG-2024-0142',
    notes: 'Comment',
    notesPlaceholder: 'Describe the maintenance carried out, condition or any findings (optional)',
    images: 'Photos',
    addImages: '+ Attach photos',
    removeImage: 'Remove',
    consent:
      'Email me a receipt and a reminder before the next recommended maintenance.',
    submit: 'Submit maintenance →',
    sending: 'Sending…',
    successTitle: 'Maintenance logged',
    successBody:
      'Thank you! The report has been sent to NorthWest Coast. If you entered an email address, you have received a receipt you can use as documentation at inspection.',
    tooLarge: (fileName: string) => `The image “${fileName}” is too large (max 5 MB).`,
  },

  notFound: {
    code: '404',
    title: 'Page not found',
    body: 'We could not find the page you were looking for. It may have moved or been removed.',
    cta: 'Go to the homepage →',
    help: 'Need help? Call',
  },

  errors: {
    generic: 'Something went wrong. Please try again.',
  },

  // ── About us, Products and the 3D page ──

  account: {
    navLabel: 'Log in',
    title: 'Log in to Min side, the customer portal (in Norwegian)',
  },

  about: {
    navLabel: 'About us',
    label: 'About NorthWest Coast',
    title: 'Innovation from Ålesund',
    intro:
      'NorthWest Coast was founded by three entrepreneurs from Ålesund. With support from local investors and organisations such as Innovation Norway and the Municipality of Ålesund, we have developed a ladder that sets new standards for safety and efficiency.',
    production: {
      label: 'Made in Sunnmøre',
      title: 'Local production',
      sub: 'Our ladders are proudly made in Sunnmøre, with components from local suppliers. This ensures high quality and supports local business.',
      chain:
        'Step and strap fittings are supplied by Pla-Mek, the extenders are made by Rempro, the blocks come from Mesterplast and the straps are sewn at Sula Bedriftstjeneste, before everything is assembled at Haram Industrier.',
      suppliersLabel: 'Our suppliers',
      roles: {
        plaMek: 'Step and strap fittings',
        rempro: 'Extenders',
        mesterplast: 'Blocks',
        sula: 'Straps',
        haram: 'Assembly',
      },
      visit: (name: string) => `Visit the ${name} website`,
      imageAlt: 'The Argostep ladder folded',
    },
    founders: {
      label: 'The founders',
      title: 'Over 80 years of combined experience',
      sub: 'With more than 80 years of combined maritime experience, our team brings a deep understanding of life at sea and a passion for improving it. Based in Ålesund, we continue our journey towards innovation and safety.',
      role: 'Founder',
    },
    supporters: {
      label: 'Supporters',
      title: 'Backed by leading organisations',
      sub: 'Our development has been made possible by support from Innovation Norway and the Municipality of Ålesund, together with local investors who share our vision of safer and more efficient maritime operations.',
      names: ['Innovation Norway', 'Municipality of Ålesund'],
    },
  },

  products: {
    navLabel: 'Products',
    overview: 'Product overview',
    label: 'Range',
    title: 'Our products',
    sub: 'Innovative maritime solutions for safe boarding and practical storage.',
    anchors: {
      ladders: 'Ladders',
      storage: 'Storage',
      parts: 'Spare parts and service',
    },
    ladder: {
      label: 'Ladders',
      title: 'Argostep embarkation and lifeboat ladder',
      desc: 'The ultimate modular ladder for both embarkation and lifeboat use. Ultra-compact when folded, robust and safe when deployed.',
      features: [
        'Modular construction from 2 to 15 metres',
        'Approved by the Norwegian Maritime Authority',
        'Folds ultra-compact',
        'Considerably lighter than traditional wooden ladders',
        'Weather-resistant materials',
        'Easy to mount and store',
      ],
      more: 'See product details →',
      view3d: 'See the ladder in 3D →',
    },
    range: {
      label: 'Lengths and prices',
      title: 'Find the length that fits',
      sub: (min: number, max: number) =>
        `Argostep comes in standard lengths from ${min} to ${max} metres. Get in touch if you need something else and we will put together a package for you.`,
      caption: 'Standard lengths, number of steps and indicative prices for Argostep',
      price: 'Price excl. VAT',
    },
    storage: {
      label: 'Storage',
      title: 'Storage cabinet',
      desc: 'A compact, robust storage solution designed specifically for Argostep ladders. Protects the equipment from wind and weather.',
      features: [
        'Weatherproof construction',
        'Easy to mount on a bulkhead or on deck',
        'Compact design',
        'Lockable for security',
      ],
      caption: 'Cabinet models, the ladder lengths they fit and indicative prices',
      model: 'Model',
      fits: 'Fits ladder',
      fitsRange: (min: number, max: number) => (min === max ? `${min} m` : `${min}–${max} m`),
      from: 'from',
      order: 'Order a ladder with cabinet →',
      alts: {
        closed: 'Closed storage cabinet mounted on a bulkhead on board',
        deck: 'Storage cabinet mounted by the rail on deck',
        open: 'Open cabinet with the folded Argostep ladder inside',
      },
    },
    parts: {
      label: 'Spare parts and service',
      title: 'Replace a part, not the whole ladder',
      sub: 'Argostep is modular. Individual steps and components can be ordered separately, so you replace what is worn instead of the whole ladder.',
      cards: {
        parts: {
          title: 'Spare parts',
          desc: 'Individual steps and components are supplied separately. Get in touch and we will find the right parts for your ladder.',
          cta: 'Contact us →',
        },
        service: {
          title: 'Service and maintenance',
          desc: 'Contact us about a service agreement, and log completed maintenance for your vessel – with an email receipt as documentation at inspection.',
          cta: 'Log maintenance →',
        },
        customer: {
          title: 'Already a customer?',
          desc: 'On Min side, our customer portal (in Norwegian), you can order spare parts and service for your ladders.',
          cta: 'Log in to Min side →',
        },
      },
    },
    help: {
      title: 'Need help choosing the right product?',
      sub: 'Contact us for a no-obligation chat about your needs.',
      cta: 'Contact us →',
    },
  },

  viewerPage: {
    navLabel: '3D model',
    label: '3D and AR',
    title: 'Argostep in 3D',
    sub: 'Use your mouse to rotate the ladder. On a phone you can also view it in AR.',
    howLabel: 'How to use the model',
    howTitle: 'Rotate, zoom and take a closer look',
    hints: {
      rotate: {
        title: 'Rotate',
        desc: 'Click and drag with the mouse, or drag with one finger on a phone.',
      },
      zoom: {
        title: 'Zoom',
        desc: 'Scroll with the mouse, or pinch with two fingers on a phone.',
      },
      fullscreen: {
        title: 'Full screen',
        desc: 'The button at the top right of the viewer lets the model fill the whole screen.',
      },
      ar: {
        title: 'AR on your phone',
        desc: 'On phones and tablets that support AR, an AR button appears in the viewer. Tap it to place the ladder in the room in front of you.',
      },
    },
    specsLabel: 'Specifications',
    specsTitle: 'Technical details',
    specsSub: 'Technical details for the Argostep maritime ladder.',
    specs: {
      stepWeight: { key: 'Weight per step', val: '1.2 kg' },
      width: { key: 'Width', val: '45 cm' },
    },
    modularTitle: 'Modular construction',
    modularBody:
      'Argostep is modular and adapted to your vessel, with standard lengths from 2 to 15 metres. Get in touch if you need something else.',
  },
};
