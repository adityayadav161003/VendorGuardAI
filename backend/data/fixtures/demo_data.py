from datetime import date, timedelta

DEMO_SUPPLIERS = [
    {
        "supplier_id": "sup-abc-pkg-001",
        "name": "ABC Packaging Pvt Ltd",
        "business_type": "Private Limited",
        "industry": "Packaging & Corrugated Boxes",
        "website": "https://www.abcpackaging.co.in",
        "address": "Plot 42, Sector 62, Noida, Uttar Pradesh - 201301",
        "status": "REVIEW_PENDING",
        "years_in_business": 7,
        "incorporation_year": 2017,
        "gstin": "09ABCDE1234F125",
        "pan": "ABCDE1234F",
        "gstin_verified": True,
        "incorporation_verified": True,
        "bank_account": {
            "account_number": "987654321012",
            "ifsc": "HDFC0000128",
            "bank_name": "HDFC Bank Ltd",
            "holder_name": "ABC Pack Pvt Ltd"  # Mismatch with ABC Packaging Pvt Ltd
        },
        "iso_cert": {
            "cert_number": "ISO-9001-2015-8842",
            "expiry_date": (date.today() + timedelta(days=47)).strftime("%d-%m-%Y")
        },
        "directors": [
            {
                "name": "Rajesh Kumar",
                "din": "07452109",
                "other_companies": ["Apex Boxpack Ltd", "Global Polyfilms Pvt Ltd"]
            },
            {
                "name": "Sunita Sharma",
                "din": "08912344",
                "other_companies": []
            }
        ],
        "evidence_sources": [
            {
                "evidence_id": "ev-gst-1",
                "source_type": "GST Portal & Registration Certificate",
                "title": "Form GST REG-06",
                "snippet": "GSTIN 09ABCDE1234F125 registered to ABC Packaging Pvt Ltd, Status: Active. State: Uttar Pradesh.",
                "reliability_score": 0.99
            },
            {
                "evidence_id": "ev-mca-1",
                "source_type": "MCA21 Registry",
                "title": "Certificate of Incorporation",
                "snippet": "CIN U21014UP2017PTC098765. ABC Packaging Private Limited incorporated in 2017 at Registrar of Companies Kanpur.",
                "reliability_score": 0.98
            },
            {
                "evidence_id": "ev-iso-1",
                "source_type": "ISO 9001:2015 Quality Certificate",
                "title": "Quality Management System Certificate",
                "snippet": f"ISO 9001:2015 Certificate valid until {(date.today() + timedelta(days=47)).strftime('%d-%m-%Y')} (expires in 47 days).",
                "reliability_score": 0.92
            },
            {
                "evidence_id": "ev-bank-1",
                "source_type": "Bank Proof / Cancelled Cheque",
                "title": "HDFC Bank Statement & Cheque",
                "snippet": "Account Number 987654321012 under name 'ABC Pack Pvt Ltd' (name mismatch against registered legal name).",
                "reliability_score": 0.95
            },
            {
                "evidence_id": "ev-dir-1",
                "source_type": "MCA Director Master Data",
                "title": "Director Network Analysis",
                "snippet": "Director Rajesh Kumar (DIN 07452109) is an active director in ABC Packaging Pvt Ltd, Apex Boxpack Ltd, and Global Polyfilms Pvt Ltd.",
                "reliability_score": 0.94
            },
            {
                "evidence_id": "ev-rev-1",
                "source_type": "B2B Marketplace & Review Aggregator",
                "title": "Online Vendor Feedback",
                "snippet": "Found 3 negative supplier reviews regarding delivery delays and disputed packaging specifications.",
                "reliability_score": 0.78
            }
        ]
    },
    {
        "supplier_id": "sup-zenith-002",
        "name": "Zenith Precision Components Pvt Ltd",
        "business_type": "Private Limited",
        "industry": "Industrial Machinery",
        "website": "https://www.zenithprecision.com",
        "address": "B-14, Peenya Industrial Area, Bengaluru, Karnataka - 560058",
        "status": "VERIFIED",
        "years_in_business": 12,
        "incorporation_year": 2012,
        "gstin": "29AAACZ1234D1Z2",
        "pan": "AAACZ1234D",
        "gstin_verified": True,
        "incorporation_verified": True,
        "bank_account": {
            "account_number": "50200012345678",
            "ifsc": "ICIC0000021",
            "bank_name": "ICICI Bank Ltd",
            "holder_name": "Zenith Precision Components Pvt Ltd"
        },
        "iso_cert": {
            "cert_number": "ISO-9001-2015-1120",
            "expiry_date": (date.today() + timedelta(days=580)).strftime("%d-%m-%Y")
        },
        "directors": [
            {
                "name": "Anil Rao",
                "din": "01234567",
                "other_companies": []
            }
        ],
        "evidence_sources": [
            {
                "evidence_id": "ev-zen-1",
                "source_type": "GST Portal",
                "title": "Form GST REG-06",
                "snippet": "GSTIN 29AAACZ1234D1Z2 Active, zero compliance default.",
                "reliability_score": 0.99
            }
        ]
    },
    {
        "supplier_id": "sup-shell-003",
        "name": "Apex Shell Trade Ventures LLP",
        "business_type": "LLP",
        "industry": "General Trading",
        "website": "",
        "address": "Room 4, Chawl No 7, Dharavi, Mumbai - 400017",
        "status": "FLAGGED",
        "years_in_business": 1,
        "incorporation_year": 2025,
        "gstin": "27AABCT9999M1Z8",
        "pan": "XYZPA1111K",  # Severe mismatch with GSTIN
        "gstin_verified": False,
        "incorporation_verified": False,
        "bank_account": {
            "account_number": "1122334455",
            "ifsc": "SBIN0001122",
            "bank_name": "State Bank of India",
            "holder_name": "Individual Savings Account"
        },
        "iso_cert": None,
        "directors": [
            {
                "name": "Dharmesh Shah",
                "din": "09998877",
                "other_companies": ["Bright Nova LLP", "Falcon Star Exports", "Titan Global LLP", "Vortex Trading"]
            }
        ],
        "evidence_sources": [
            {
                "evidence_id": "ev-sh-1",
                "source_type": "Sanctions & Watchlist",
                "title": "Shell Company Risk Alert",
                "snippet": "5 dormant companies registered at same residential room address with circular billing indicators.",
                "reliability_score": 0.95
            }
        ]
    }
]
# ABC Packaging benchmark
# Additional benchmarks
