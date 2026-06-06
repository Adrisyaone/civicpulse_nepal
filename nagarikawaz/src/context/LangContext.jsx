import React, { createContext, useContext, useState } from 'react'

const Ctx = createContext(null)

const UI = {
  appName:       { ne: 'नागरिक आवाज',              en: 'NagarikAwaz'           },
  map:           { ne: 'नक्सा',                     en: 'Map'                   },
  feed:          { ne: 'सूची',                      en: 'Feed'                  },
  report:        { ne: 'रिपोर्ट',                   en: 'Report'                },
  dashboard:     { ne: 'ड्यासबोर्ड',               en: 'Dashboard'             },
  aiReports:     { ne: 'AI रिपोर्ट',               en: 'AI Reports'            },
  admin:         { ne: 'प्रशासन',                   en: 'Admin'                 },
  signIn:        { ne: 'लग इन',                     en: 'Sign In'               },
  signOut:       { ne: 'लग आउट',                    en: 'Sign Out'              },
  register:      { ne: 'दर्ता',                     en: 'Register'              },
  myReports:     { ne: 'मेरा रिपोर्ट',              en: 'My Reports'            },
  settings:      { ne: 'सेटिङ',                    en: 'Settings'              },
  submit:        { ne: 'पेश गर्नुहोस्',              en: 'Submit'                },
  cancel:        { ne: 'रद्द',                      en: 'Cancel'                },
  save:          { ne: 'सुरक्षित',                   en: 'Save'                  },
  loading:       { ne: 'लोड हुँदैछ…',              en: 'Loading…'             },
  noData:        { ne: 'डाटा फेला परेन',             en: 'No data found'         },
  province:      { ne: 'प्रदेश',                    en: 'Province'              },
  district:      { ne: 'जिल्ला',                    en: 'District'              },
  palika:        { ne: 'पालिका',                    en: 'Palika'                },
  ward:          { ne: 'वडा नं.',                   en: 'Ward No.'              },
  category:      { ne: 'श्रेणी',                    en: 'Category'              },
  severity:      { ne: 'गम्भीरता',                  en: 'Severity'              },
  status:        { ne: 'स्थिति',                    en: 'Status'                },
  titleField:    { ne: 'शीर्षक',                    en: 'Title'                 },
  description:   { ne: 'विवरण',                     en: 'Description'           },
  location:      { ne: 'स्थान',                     en: 'Location'              },
  photos:        { ne: 'तस्वीर',                    en: 'Photos'                },
  upvote:        { ne: 'समर्थन',                    en: 'Upvote'                },
  comment:       { ne: 'टिप्पणी',                   en: 'Comment'               },
  addComment:    { ne: 'टिप्पणी थप्नुहोस्',         en: 'Add Comment'           },
  progress:      { ne: 'प्रगति',                    en: 'Progress'              },
  department:    { ne: 'विभाग',                     en: 'Department'            },
  officer:       { ne: 'अधिकारी',                   en: 'Officer'               },
  generate:      { ne: 'AI रिपोर्ट बनाउनुहोस्',    en: 'Generate AI Report'    },
  reportIssue:   { ne: 'समस्या रिपोर्ट',            en: 'Report Issue'          },
  viewDetails:   { ne: 'विवरण',                     en: 'View'                  },
  allProvinces:  { ne: 'सबै प्रदेश',               en: 'All Provinces'         },
  phone:         { ne: 'फोन',                       en: 'Phone'                 },
  name:          { ne: 'नाम',                       en: 'Name'                  },
  email:         { ne: 'इमेल',                      en: 'Email'                 },
  password:      { ne: 'पासवर्ड',                   en: 'Password'              },
  role:          { ne: 'भूमिका',                    en: 'Role'                  },
  next:          { ne: 'अर्को',                     en: 'Next'                  },
  back:          { ne: 'पछाडि',                     en: 'Back'                  },
  search:        { ne: 'खोज्नुहोस्…',              en: 'Search…'               },
  filter:        { ne: 'फिल्टर',                    en: 'Filter'                },
  clearFilters:  { ne: 'फिल्टर हटाउनुहोस्',        en: 'Clear filters'         },
  backToMap:     { ne: 'नक्सामा फर्कनुहोस्',        en: 'Back to map'           },
  newReport:     { ne: 'नयाँ रिपोर्ट',              en: 'New Report'            },
  engagement:    { ne: 'सहभागिता',                  en: 'Engagement'            },
  officerActions:{ ne: 'अधिकारी कार्य',            en: 'Officer Actions'       },
  assignDept:    { ne: 'विभाग तोक्नुहोस्',          en: 'Assign Department'     },
  statusSteps:   { ne: 'स्थिति चरण',               en: 'Status Steps'          },
  exec:          { ne: 'कार्यकारी सारांश',          en: 'Executive Summary'     },
  priority:      { ne: 'प्राथमिकता',               en: 'Priority'              },
  trends:        { ne: 'प्रवृत्ति',                 en: 'Trends'                },
  budget:        { ne: 'बजेट सिफारिस (NPR)',        en: 'Budget Recommendations (NPR)' },
  actions:       { ne: 'सिफारिस',                   en: 'Recommended Actions'   },
  openDoc:       { ne: 'Google Doc खोल्नुहोस्',    en: 'Open Google Doc'       },
  reportedBy:    { ne: 'रिपोर्टकर्ता',              en: 'Reported by'           },
  submitted:     { ne: 'पेश मिति',                  en: 'Submitted'             },
  updated:       { ne: 'अपडेट',                     en: 'Updated'               },
  resolved:      { ne: 'समाधान मिति',               en: 'Resolved'              },
  unassigned:    { ne: 'तोकिएको छैन',              en: 'Unassigned'            },
  noUpdates:     { ne: 'अहिलेसम्म कुनै अपडेट छैन।', en: 'No updates yet.'      },
  noComments:    { ne: 'अहिलेसम्म कुनै टिप्पणी छैन।', en: 'No comments yet.'  },
  addUpdate:     { ne: 'अपडेट',                     en: 'Update'                },
  byCategory:    { ne: 'श्रेणीअनुसार',              en: 'By Category'           },
  byStatus:      { ne: 'स्थितिअनुसार',              en: 'By Status'             },
  bySeverity:    { ne: 'गम्भीरताअनुसार',            en: 'By Severity'           },
  criticalIssues:{ ne: 'अति गम्भीर — तत्काल ध्यान', en: 'Critical — Immediate Attention' },
  topPriority:   { ne: 'शीर्ष प्राथमिकता रिपोर्ट', en: 'Top Priority Reports'  },
  allClear:      { ne: 'सब ठीक छ!',                en: 'All clear!'            },
  noCritical:    { ne: 'यस क्षेत्रमा खुला रिपोर्ट छैन।', en: 'No open reports in this area.' },
  prevReports:   { ne: 'पुराना AI रिपोर्ट',        en: 'Previous AI Reports'   },
  noAIReports:   { ne: 'अहिलेसम्म कुनै AI रिपोर्ट छैन।', en: 'No AI reports yet.' },
  analyzed:      { ne: 'रिपोर्ट विश्लेषण',         en: 'reports analyzed'      },
  geminiAnalyzing:{ ne:'Gemini ले विश्लेषण गर्दैछ…', en:'Gemini analyzing…'  },
  aiGenerated:   { ne: 'AI रिपोर्ट तयार भयो!',     en: 'AI report generated!'  },
  communityFeed: { ne: 'नागरिक सूची',              en: 'Community Feed'        },
  reports:       { ne: 'रिपोर्ट',                   en: 'reports'               },
  noReports:     { ne: 'कुनै रिपोर्ट फेला परेन',   en: 'No reports found'      },
  pinLocation:   { ne: 'स्थान चिन्ह लगाउनुहोस्',   en: 'Pin the location'      },
  detectingLoc:  { ne: 'स्थान पत्ता लगाउँदैछ…',   en: 'Detecting location…'   },
  clickMap:      { ne: 'नक्सामा क्लिक गर्नुहोस्',  en: 'Click map to place marker' },
  dupWarning:    { ne: 'मिल्दो रिपोर्ट फेला पर्यो', en: 'Similar reports nearby' },
  continueAnyway:{ ne: 'जारी राख्नुहोस्',           en: 'Continue anyway'       },
  or:            { ne: 'वा',                        en: 'or'                    },
  noAccount:     { ne: 'खाता छैन?',                en: "No account?"           },
  haveAccount:   { ne: 'पहिले नै खाता छ?',         en: 'Already have account?' },
  magicLink:     { ne: 'म्याजिक लिंक',              en: 'Magic Link'            },
  google:        { ne: 'Google मार्फत',             en: 'Continue with Google'  },
  sendMagic:     { ne: 'म्याजिक लिंक पठाउनुहोस्', en: 'Send Magic Link'       },
  magicSent:     { ne: 'म्याजिक लिंक पठाइयो! इमेल जाँच्नुहोस्।', en: 'Magic link sent! Check email.' },
  createAccount: { ne: 'खाता खोल्नुहोस्',           en: 'Create Account'        },
  nameNp:        { ne: 'नाम (नेपाली)',              en: 'Name (Nepali)'         },
  nameEn:        { ne: 'Name (English)',            en: 'Name (English)'        },
  confirmPw:     { ne: 'पासवर्ड पुष्टि',            en: 'Confirm Password'      },
  pwMismatch:    { ne: 'पासवर्ड मेल खाएन',          en: 'Passwords do not match' },
  pwMin:         { ne: 'कम्तीमा ८ अक्षर',          en: 'Min 8 characters'      },
  accountCreated:{ ne: 'खाता बन्यो! इमेल जाँच्नुहोस्।', en: 'Account created! Check email.' },
  loginRequired: { ne: 'लगइन आवश्यक छ',            en: 'Sign in required'      },
  loginToReport: { ne: 'रिपोर्ट पेश गर्न लगइन गर्नुहोस्।', en: 'Please sign in to submit.' },
  submitting:    { ne: 'पेश गर्दैछ…',              en: 'Submitting…'           },
  darta:         { ne: 'दर्ता गर्नुहोस्',           en: 'Submit Report'         },
  details:       { ne: 'विवरण',                     en: 'Details'               },
  photosStep:    { ne: 'तस्वीर',                    en: 'Photos'                },
  addPhotos:     { ne: 'तस्वीर थप्नुहोस्',          en: 'Add photos'            },
  photosOptional:{ ne: 'तस्वीर (वैकल्पिक, अधिकतम ५)', en: 'Photos (optional, max 5)' },
  summaryTitle:  { ne: 'सारांश',                    en: 'Summary'               },
  uploaded:      { ne: 'अपलोड',                     en: 'uploaded'              },
  openInDrive:   { ne: 'Drive मा खोल्नुहोस्',       en: 'Open in Drive'         },
  govDashboard:  { ne: 'सरकारी ड्यासबोर्ड',        en: 'Government Dashboard'  },
  allProvinces2: { ne: 'सबै प्रदेश',               en: 'All provinces'         },
  palikaNe:      { ne: 'पालिकाको नाम…',             en: 'Palika name…'          },
  totalReports:  { ne: 'कुल रिपोर्ट',               en: 'Total Reports'         },
  openIssues:    { ne: 'खुला समस्या',               en: 'Open Issues'           },
  critical:      { ne: 'अति गम्भीर',               en: 'Critical'              },
  resolvedStat:  { ne: 'समाधान',                    en: 'Resolved'              },
  userMgmt:      { ne: 'प्रयोगकर्ता व्यवस्थापन',   en: 'User Management'       },
  registered:    { ne: 'दर्ता प्रयोगकर्ता',         en: 'registered users'      },
  profile:       { ne: 'प्रोफाइल',                  en: 'Profile'               },
  dangerZone:    { ne: 'खतरा क्षेत्र',              en: 'Danger Zone'           },
  notFound:      { ne: 'पृष्ठ फेला परेन',          en: 'Page not found'        },
  score:         { ne: 'स्कोर',                     en: 'score'                 },
  docLink:       { ne: 'Doc',                       en: 'Doc'                   },
  selectOpt:     { ne: 'छान्नुहोस्…',              en: 'Select…'               },
  titleNpLabel:  { ne: 'शीर्षक (नेपाली)',           en: 'Title (Nepali)'        },
  descNpLabel:   { ne: 'विवरण (नेपाली)',            en: 'Description (Nepali)'  },
  palikTypeLabel:{ ne: 'पालिका प्रकार',             en: 'Palika Type'           },
  noteNpLabel:   { ne: 'नोट (नेपाली)',              en: 'Note (Nepali)'         },
  signInComment: { ne: 'लगइन गरेर टिप्पणी गर्नुहोस्', en: 'Sign in to comment' },
  addCommentPH:  { ne: 'टिप्पणी थप्नुहोस्…',       en: 'Add a comment…'        },
  progressDescPH:{ ne: 'कार्य प्रगतिको विवरण…',    en: 'Progress description…' },
  wardLabel:     { ne: 'वडा',                       en: 'Ward'                  },
  titleNpPH:     { ne: 'जस्तै: मुख्य सडकमा ठूलो खाल्डो', en: 'e.g. Large pothole on main road' },
  descNpPH:      { ne: 'समस्याको विस्तृत विवरण लेख्नुहोस्…', en: 'Describe the issue in detail…' },
  palikaPHLabel: { ne: 'जस्तै: पोखरा महानगरपालिका', en: 'e.g. Pokhara Metropolitan' },
  wardNoPH:      { ne: '१',                         en: '1'                     },
  somethingWrong:{ ne: 'केही गडबड भयो',            en: 'Something went wrong'  },
  reload:        { ne: 'पुनः लोड',                  en: 'Reload'                },
  signInSubtitle:{ ne: 'आफ्नो खातामा लगइन गर्नुहोस्', en: 'Sign in to your account' },
  citizenVoice:  { ne: 'नागरिक आवाज',              en: 'Citizen Voice'         },
}

export function LangProvider({ children }) {
  const saved = (() => { try { return localStorage.getItem('na_lang') || 'ne' } catch { return 'ne' } })()
  const [lang, setLang] = useState(saved)

  function toggleLang() {
    const next = lang === 'ne' ? 'en' : 'ne'
    setLang(next)
    try { localStorage.setItem('na_lang', next) } catch {}
  }

  function tr(key) {
    const o = UI[key]
    if (!o) return key
    return lang === 'ne' ? (o.ne || o.en) : (o.en || o.ne)
  }

  // pick from an object with _np / _en fields
  function tObj(obj, field) {
    if (!obj) return ''
    const np = obj[field + '_np']
    const en = obj[field + '_en']
    return lang === 'ne' ? (np || en || '') : (en || np || '')
  }

  return <Ctx.Provider value={{ lang, toggleLang, tr, tObj }}>{children}</Ctx.Provider>
}

export const useLang = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLang must be inside LangProvider')
  return c
}
