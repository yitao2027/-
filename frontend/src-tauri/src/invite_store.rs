// invite_store — 邀请码后端存储模块（v5.5.x B100修复）
// 
// 安全设计：
//   1. 500个邀请码编译期嵌入二进制，不在前端暴露
//   2. 使用状态持久化在 ~/.shaoziclaw/invite_codes.json
//   3. 一码一用，不可重复
//   4. 首次启动自动烧录码表

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;

// ═══════════════════════════════════════════
// 500个邀请码（编译期嵌入，不可从前端获取）
// ═══════════════════════════════════════════

const EMBEDDED_CODES: &[&str] = &[
    "25VJSY2A55C", "2639WAJF768", "27SAXJUZBDD", "2B3ZRCHT555", "2G7S73R9685",
    "2JWE5M6UD98", "2MN3E9EPBBF", "2MRRZMGMDD8", "2S9GN6Q772D", "2SK9FHLA38D",
    "2V93KAT5899", "35R8LLGRBEE", "37QYXNEBAF7", "3DC9PSYM775", "3GXX2T9H859",
    "3MGEX23W265", "3PFV46KS6EA", "3TGV5YHDA7E", "3VHPYYXHCF5", "3ZGCXUXT453",
    "3ZWYRVCAD6A", "4665HLQY96A", "48EU5VUU9B9", "49A8DDB46FC", "4B9FZABA83A",
    "4CXLW5G46FE", "4GG64UXUAF4", "4HYUQKU9F83", "4JMAQLSJ62E", "4U8MKE3JFB9",
    "4UA38A8V5FB", "532DYH2L239", "54CWLCLB277", "56A73DSF485", "5ARQ5M3Z6E3",
    "5CSLEBG5E3E", "5D5DW4769C5", "5FGKQLU2C8A", "5GRLQSVP4ED", "5L74Y7NJE8A",
    "5NGFJQLJ995", "5PMZYDZFBEC", "5TBJZUDBAAB", "5VPKAQ2GEB3", "5VRSYS6YB77",
    "5Y4LVGNQ384", "5YDV86MKEC7", "5YNCJF82EB9", "63UYQZEZ35B", "6A4LQKWU46A",
    "6KKVNCFHE8A", "6MJYLLA9D44", "6NST7G8C66C", "6PRYE94Y6EA", "6R5UR8LSDD2",
    "6RM27CEP5CC", "6S5XSMRFB9E", "6SKVJ48B37A", "6SZ7YBR7AE7", "6WXE2C3JBC5",
    "6Y7ED2CGAE7", "6ZAUJAFTD7E", "74FL4PWC544", "75RSTM6238F", "77WLFDGE632",
    "79RAUFKG27D", "7CT6FCL8734", "7DELMQK348E", "7DYZ3LXKD42", "7F73EPMEF23",
    "7F7ARVZ6225", "7G7772SD69A", "7J4V3XD7A22", "7J77GU5Q757", "7NXLNYWE3A8",
    "7TLX63BDD52", "7WK2EWZX8FE", "7YY4BFVUA2A", "7Z3CSHNJAC6", "823X94S75E7",
    "864S39PLC6E", "8675ZYG39EC", "86KRDAXKC88", "8BTA376CDC6", "8C5RD332D2D",
    "8CD7WURV47F", "8D96HHDD78C", "8DXKKA5G2B9", "8EQRKMPV82B", "8HJ4E2GH3E7",
    "8JZL35WSD77", "8KBNVK4LAA5", "8MHU3QFNC6C", "8MKFJQZRB93", "8MZPXR2J8CF",
    "8QJFRVFJ7CC", "8QXN46F642A", "8RXSJNUZE7A", "8U8AQWQV774", "8XN6FECY5BE",
    "8ZB22D6N2DF", "95QLXPBAFC4", "9657TP6S395", "98C5ZZXTA8B", "9C2LERWC339",
    "9CB6VU5X2EC", "9DSFDLNGFD2", "9E9P9DNEFF8", "9HGBE2XKFBD", "9L2L9AMQ8CF",
    "9MQXNUKC374", "9WV8LL6L5DF", "9X63ZUP37E4", "9Y84WMD287A", "9YTQUY5BCCE",
    "9YU4AEBBB4F", "A7WVECMLB4C", "A8E8DQ3DF2C", "A8JN4PDHADA", "AB58STBC679",
    "ADQKWGSH653", "AEVJGN5G6BC", "AF2VA4BP3FF", "AJNM7ZBY758", "AKBLD65Z5EE",
    "AMDPTQDA326", "APYRQVYBBDA", "AS4V6PRLBF2", "AU5RY2U8F7B", "AUT2NDLJBBE",
    "AVGLRM47EBA", "AX6L7KCGD9A", "B4FJKXW454A", "B66CS4FA9D5", "B94NDN6QBB6",
    "BAUK8YMM283", "BAY3JABD35C", "BC2ZS3BMCA2", "BEFRW87EAE7", "BFTWXFQ93C6",
    "BFWZQMRG2F2", "BHN2SGNZC25", "BHQ7VNN838A", "BK24K9AY244", "BNQKVLMP8B7",
    "BRKQCLQEAA5", "BSQSQ6MQAF7", "BUHE9SUP89D", "BY6WSJG83DB", "BYQT4VY6C6B",
    "C5AEFQLTABE", "C725BN3CCCE", "CA4QWJP4376", "CBSYLBBZ3F5", "CCLDXZGEB7C",
    "CJS5W46G6FB", "CNGYYWHX9AC", "CNHZ3GGXB79", "CPNGHR2W87E", "CTGSLPJS7AA",
    "CTVAL7DE49F", "CUL4WYBAF3D", "CXPJD2EP9E5", "CZQJHBTW883", "D3Z9ZE4WBDF",
    "D45GDX4MA27", "D4H7YWZMCFB", "D4QQFS3RCBC", "D6CZRRK6823", "D6JBJ3NQ49B",
    "DDHUGGP94F4", "DDJWHJJS982", "DDUUC87EDFD", "DFWM8MJS8F9", "DJVC5RQ83C8",
    "DPWY2UWW67B", "DRG8DRVZ4EF", "DTFVF9SP837", "DVURW9L7DE7", "DWZ7PJZG5F6",
    "DX6PAEPRAF7", "DXHJAZ968EB", "DYHE94VV5D4", "E4YMDVH359F", "E9CFWHEA267",
    "E9Y5JGZY5BB", "EAPHSVK4544", "ECK3VUSTBDB", "EET3QCBG5E5", "ELX7M8CZ39F",
    "EPYJRLGLD78", "EQ5RBF7ZEC8", "ERUZ4M9R6DB", "ETDF7NP8BD9", "EUT7QD6XFB6",
    "EZAFQG5KD23", "F5KJYU954DE", "F7DZ8WXW39E", "FF9SQZG2522", "FGDYTBDM75A",
    "FGPQUC9R39B", "FGWJW2EJ95A", "FHL8P4BM93E", "FM6ASGLZEFA", "FM8QUPVN862",
    "FN8XUGDU4A4", "FNKJ227S647", "FP59U9PY2C4", "FPW4BB28699", "FXJUBM9F6A7",
    "G4KEL6HA8C5", "G553CJ8G9D9", "GAPUX3CACD8", "GEFW9VFU8E8", "GLM7RUBGF9E",
    "GM76FCJU5ED", "GNCCLZCKB7B", "GNU5FDXH373", "GP5T8CYR82D", "GTGGU5KR9F5",
    "GU8N93KAFD8", "GVYB5L2E659", "GWQEXUWY4FA", "GWVJUEUXC8B", "H55CAAZZ52F",
    "H5USZDNXA79", "H7NE7NYK2E4", "H8HLQZR6EA6", "H9BM97NNB7B", "H9Y4DHPMB84",
    "HCFWHKQSC4C", "HHE5Q5TU875", "HKXYFBTV58C", "HLRVQNUDDAC", "HLUE46N4F42",
    "HLXR59AZ974", "HMR2FKQE72C", "HP4E4ZMY974", "HR8C9GYFDD5", "HS3NNZYBCE2",
    "HTFXQEQ28BC", "HU4PP2FLC6D", "HX7T3KLEEF7", "HY4DD7HX26F", "HYS2AY3H8A7",
    "HZZG6QFP9B9", "J4MFAF7D6FA", "J6W65ETDABF", "JBCJZQ66A82", "JDJWV8ZW85D",
    "JG9GGB59F75", "JJ4DUJTQAF5", "JK6BNC3ED44", "JRFMR6AYDFA", "JTJ9W2U74FC",
    "JUQJU7NGFD7", "JYJJHXFT854", "JZGZHP7EECB", "K2FDMYFCA5B", "K77CXNB969F",
    "K7ACBUARE35", "K95VPN2K7AB", "K98WHFPV9DD", "K9Y6KX78366", "KDQGLDGYFDC",
    "KDR9NZXAFB5", "KFGWBRVDC55", "KG5AUQV8C76", "KGUQCWZTE59", "KPKESQGAEC6",
    "KQ3ET44GE54", "KQSX5S8MCF7", "KSXKZD8JC48", "KUEQBXG5ABB", "L2G8QHSVEDD",
    "L472AF9V3EC", "L6FC744TF2B", "L8AGZBFMD96", "LDXZW9VH64E", "LG7M787J353",
    "LJ7YWKZG7EA", "LJSXHSYXBCC", "LMA4CYAD874", "LNNNQ5K24CE", "LRNMAQDE6F3",
    "LTCQSYAR362", "LTYLF3PG267", "LVXX9GLSF79", "LWTU7KVC38B", "LX5ZX8Z4A29",
    "LZF72HQY2CB", "M22974FP4B7", "M8U23496757", "M9L23JDN549", "MAYTJRAJCC5",
    "MBMQ72UTA2C", "MCCP2G5UF42", "ME6F96R3A3E", "MF4HF2H7C45", "MK7Q5DLJCF3",
    "MM8QLV3EAD3", "MPHWSUH2E37", "MUGRT6LYFFE", "MY9DWMRAB64", "MZBNH264286",
    "N5XBJ88YD8E", "N62F4K4UA24", "N6PPAB7TA79", "N7JF5ER6269", "N9L4YJBK9EF",
    "NB7NUEMF74C", "NBKF4VE7F92", "NF5396TF34A", "NFR8SUVE4B6", "NHYTYTFD395",
    "NPJXNM9Q4AA", "NRWEDEVTB86", "NUWE364M666", "NWN4LQ8F3C9", "NYV8JEAL255",
    "NZHB2KNN997", "P32AF6E6DCD", "PCT9L4S7E82", "PGHCRN4B387", "PGP2X7EZ84B",
    "PKNNZYYU49D", "PKYNQGA28D3", "PL38K7E8596", "PLBQ7YEP6BB", "PLXCPLGN8BE",
    "PPDK84QCECD", "PUPT5372874", "PX7GPEQZC9E", "Q24MG97CDCD", "Q3W58CPY72F",
    "Q5XBRKVG977", "Q7YTT52TA44", "Q85Y2GR9DB9", "QMH5GWL2DCE", "QN6MAXU84F9",
    "QNHTZVZ9BFC", "QR7ZADS8946", "R4SHM9AS977", "R758BEL7693", "R872ZPPA2C3",
    "RCGWHGGXDBC", "RDTBZEYV98F", "RGQPK7PN778", "RGQPTTUCD4B", "RLV77GHF886",
    "RN87JEFUF86", "RQU3NCTA8BA", "RSCMNUX296E", "RSN6QQ33FA2", "RWHC7D6YEDF",
    "RYM3BP2X4D6", "RYRMTYNX598", "S5TT5HNP85C", "SACAE57HFE9", "SDBUGUKTDDB",
    "SFLS3ANH7F6", "SFTL7AJT5A8", "SKLLNM6N229", "SLNNHWR25B6", "SLNXF3PY5E7",
    "SMV379PJA7B", "SPC7Y4EE88F", "SQC5NGES2BC", "SQD8QHTM42D", "SSKNWLMSBFC",
    "SV6VUDSUBD6", "SVYQ56WUBBB", "SYNCFHHGDEF", "T47PATSB4A4", "T5BAZNB645F",
    "T5F43MFWB95", "T7HCMMJDE42", "TAFU3ZYL57C", "TB9Y27848B3", "TEAQWW96C56",
    "TFD95Z9429D", "TKQNF8VGF98", "TNCYE8C5853", "TQSTZZ8S7ED", "TRX54LLEFB9",
    "TTJLRWKT8B4", "TV88XWW4D39", "TVYDGCTZBBA", "TWRZBTH882C", "TX8KAPH4B6D",
    "TZFWBDRT5AE", "U2W6EQNCB22", "U3YXWZPKD55", "U6275ZWKF76", "U7L5RXC52B5",
    "U87DC2849BC", "U9THYQ32668", "UC5C2KKD4D3", "UE9UMTE98B5", "UJ7BVKBBBC8",
    "UJG24HWY22A", "ULHFS65TFE7", "UM68BDD87E4", "UNURB2SL9FD", "UPKTKVDVDC2",
    "UPVJHNBF8DD", "UQJQKHGL464", "UTVWR7FJF85", "UTWKHXLME3A", "UV2CYWQW685",
    "UVNMHMFC47B", "UVWJBV52888", "UWT7AWPV7A8", "UZ4MQZTAA84", "V23BHYGR657",
    "V83EE7C2396", "V846YAZSC38", "V8HHPUFRF64", "V8MRW68F87E", "VBVYCG8Y84D",
    "VCMD5PC5366", "VEAAV82KD2E", "VFJBJJQE8EF", "VGKX3LNU2DB", "VGMWAX6LFD6",
    "VHGYLRE5636", "VJCLXY8V28B", "VKME3UZR2FD", "VKV9ZFVG4CF", "VLS6NWGPA8F",
    "VNRLBT6R2EC", "VPLN59T7AFA", "VQ5BMYWMB4E", "VR44AVFMC9D", "VWCGF832DB7",
    "VX3LNE4684D", "VXQPZCU3C89", "W2MYTGZ8973", "W44SJTVG3F8", "WDY2PDSVAB2",
    "WFKQUV9F25A", "WJKDH62UF69", "WLXDTVPK373", "WP79R6936F8", "WSDKUX4WCE7",
    "WTFAZYU22DF", "WVPVEJGU438", "WVX636GUCB2", "WWKHPV53834", "X2QT39XY46D",
    "X35LWJHTFD3", "X3W2A457E94", "X4D4VQHB7C9", "X4WCVVY8E4A", "X5W5XJ9N4CF",
    "X6BNZPAFFA3", "X6ENAQB9D27", "X7GKTKR9C2D", "XC9UREX4258", "XCMB9M85829",
    "XCZJBQUH4BD", "XJL4X88N26F", "XL6JYKKU728", "XLMLVMEK9B2", "XUWADCJ9DDB",
    "XV4CBXW3E84", "XWZK6PFTB6D", "XX2D3K7CACF", "Y2NWHUS6D72", "Y3TW2KWN5CA",
    "Y6KUPD8W668", "Y9PY549WEF5", "YCJRS835FBB", "YGJBCLU6DF2", "YHXR9M9U6BD",
    "YLVHG4L7B24", "YM75X893D87", "YMC4K8GL3C7", "YMURYUTMD8D", "YUY4YUPUC4E",
    "Z4KV7YN27CE", "Z4PE4NLS975", "Z8VZJNLJ459", "Z8ZDXJHJ9C2", "Z9ZD37JNBDD",
    "ZA7LSNAX968", "ZC9DC8G57DE", "ZDA2VSKD82E", "ZF9SQV3TD95", "ZFA7DZH398D",
    "ZFDN9ETD523", "ZK25ZWL427C", "ZLR43ZAW2A7", "ZM4ZRXGT6BA", "ZMDPATU9665",
    "ZP8LGR2SEA5", "ZUWYK3S862D", "ZW45J87D64C", "ZY9W6YPT985", "ZYBJWXEH7D6",
];

// ═══════════════════════════════════════════
// 持久化数据结构
// ═══════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InviteCodeRecord {
    pub code: String,
    pub used: bool,
    pub used_by: Option<String>,
    pub used_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InviteCodeStore {
    pub codes: HashMap<String, InviteCodeRecord>,
}

/// 获取邀请码存储文件路径
fn get_invite_codes_path() -> Result<PathBuf, String> {
    let dir = std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".shaoziclaw"))
        .unwrap_or_else(|_| PathBuf::from("/tmp/shaoziclaw"));
    
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    Ok(dir.join("invite_codes.json"))
}

/// 懒初始化：首次调用时从嵌入码表创建JSON文件
fn ensure_store_initialized() -> Result<InviteCodeStore, String> {
    let path = get_invite_codes_path()?;
    
    // 如果JSON文件已存在，从文件加载
    if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("读取邀请码文件失败: {}", e))?;
        let store: InviteCodeStore = serde_json::from_str(&data)
            .map_err(|e| format!("解析邀请码文件失败: {}", e))?;
        return Ok(store);
    }
    
    // 首次启动：从嵌入码表创建
    let mut codes = HashMap::new();
    for code_str in EMBEDDED_CODES {
        codes.insert(code_str.to_string(), InviteCodeRecord {
            code: code_str.to_string(),
            used: false,
            used_by: None,
            used_at: None,
        });
    }
    
    let store = InviteCodeStore { codes };
    
    // 写入JSON文件
    let data = serde_json::to_string_pretty(&store)
        .map_err(|e| format!("序列化邀请码失败: {}", e))?;
    fs::write(&path, &data)
        .map_err(|e| format!("写入邀请码文件失败: {}", e))?;
    
    Ok(store)
}

/// 持久化保存
fn save_store(store: &InviteCodeStore) -> Result<(), String> {
    let path = get_invite_codes_path()?;
    let data = serde_json::to_string_pretty(store)
        .map_err(|e| format!("序列化邀请码失败: {}", e))?;
    fs::write(&path, &data)
        .map_err(|e| format!("写入邀请码文件失败: {}", e))?;
    Ok(())
}

/// 🔑 验证邀请码（只检查有效性，不标记使用）
pub fn verify_invite_code(code: &str) -> Result<VerifyResult, String> {
    let code_upper = code.trim().to_ascii_uppercase();
    
    if code_upper.is_empty() {
        return Ok(VerifyResult {
            valid: false,
            message: "邀请码不能为空".to_string(),
        });
    }
    
    if code_upper.len() != 11 {
        return Ok(VerifyResult {
            valid: false,
            message: "邀请码格式不正确（需要11位）".to_string(),
        });
    }
    
    let store = ensure_store_initialized()?;
    
    match store.codes.get(&code_upper) {
        None => Ok(VerifyResult {
            valid: false,
            message: "邀请码无效，请检查是否正确输入".to_string(),
        }),
        Some(record) if record.used => Ok(VerifyResult {
            valid: false,
            message: "该邀请码已被使用".to_string(),
        }),
        Some(_) => Ok(VerifyResult {
            valid: true,
            message: "邀请码有效".to_string(),
        }),
    }
}

/// 🔐 兑换邀请码（注册时调用，标记为已使用）
pub fn redeem_invite_code(code: &str, email: &str) -> Result<RedeemResult, String> {
    let code_upper = code.trim().to_ascii_uppercase();
    
    if code_upper.is_empty() || code_upper.len() != 11 {
        return Ok(RedeemResult {
            success: false,
            message: "邀请码格式不正确".to_string(),
        });
    }
    
    let mut store = ensure_store_initialized()?;
    
    let record = match store.codes.get_mut(&code_upper) {
        Some(r) => r,
        None => {
            return Ok(RedeemResult {
                success: false,
                message: "邀请码无效".to_string(),
            });
        }
    };
    
    if record.used {
        return Ok(RedeemResult {
            success: false,
            message: "该邀请码已被其他用户使用".to_string(),
        });
    }
    
    // 标记已使用
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string();
    
    record.used = true;
    record.used_by = Some(email.to_string());
    record.used_at = Some(now);
    
    save_store(&store)?;
    
    Ok(RedeemResult {
        success: true,
        message: "邀请码验证通过".to_string(),
    })
}

/// 获取邀请码统计（管理用）
pub fn get_code_stats() -> Result<CodeStats, String> {
    let store = ensure_store_initialized()?;
    let total = store.codes.len() as u32;
    let used = store.codes.values().filter(|r| r.used).count() as u32;
    
    Ok(CodeStats {
        total,
        used,
        remaining: total - used,
    })
}

// ═══════════════════════════════════════════
// 返回类型
// ═══════════════════════════════════════════

#[derive(Debug, Serialize, Clone)]
pub struct VerifyResult {
    pub valid: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RedeemResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CodeStats {
    pub total: u32,
    pub used: u32,
    pub remaining: u32,
}
