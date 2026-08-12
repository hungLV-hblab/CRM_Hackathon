# Phản biện yêu cầu — đề bài "AI Native CRM"

- **Thời điểm:** 12/08/2026 17:42 (Asia/Tokyo)
- **Đầu vào:** [docs/hackathon-spec-ai-native-crm.md](../hackathon-spec-ai-native-crm.md) (Specs BTC phát 12/08, nguyên văn)
- **Bối cảnh đọc kèm:** [sales-ito-crm-domain.md](../sales-ito-crm-domain.md) · [ai-native-design-principles.md](../ai-native-design-principles.md) · [CLAUDE.md](../../CLAUDE.md)
- **Mục đích:** tìm mâu thuẫn, chỗ mơ hồ, edge case **trước khi** chốt stack và code. Không sửa Specs.

---

## 1. Tóm tắt yêu cầu (bằng lời mình)

Xây CRM B2B cho một đội Sales ITO, chạy tay được trọn vẹn (công ty · người liên hệ · cơ hội 7 giai đoạn · dòng thời gian · việc tiếp theo), rồi úp lên đó một lớp AI đọc **bản chụp web tĩnh** thay vì web thật. Lớp AI có bốn mức tự chủ tăng dần: chỉ rút phát hiện kèm câu trích (nhóm 2), đề xuất chờ người bấm (nhóm 3), **tự ghi vào cơ hội** nhưng có Hoàn tác 7 ngày (nhóm 4), và **tự ghi vào dòng thời gian không hỏi ai** trong vòng quét 60s (nhóm 5). Nhóm 6 là phanh: metric + chỉnh chu kỳ + nút tắt sạch AI.

Bốn ranh giới cứng chặn AI chạm giai đoạn, tiền, khách hàng thật, và dữ liệu người tạo — phải chặn được cả khi lệnh không đến từ giao diện. Chấm bằng 10 test chạy một lệnh + thử tay + demo bản production on-premise.

Thứ đề bài **không** yêu cầu (và đừng làm): soạn message tiếp cận, buyer persona, ICP scoring thành tính năng riêng, chatbot.

---

## 2. Phản biện theo persona

### 2.1. BD/Sales trực chiến — "8h sáng tôi mở cái này ra để làm gì?"

**CT-1. Màn hình tổng quan đề bài mô tả là màn báo cáo cho sếp, không phải màn làm việc của tôi.**
Spec (nhóm 1) yêu cầu tổng quan hiện: số công ty theo ngành, số cơ hội + tổng giá trị theo giai đoạn, next step quá hạn. Hai thứ đầu là số cho sếp. Thứ tôi cần lúc 8h là ba câu: *hôm nay đến hạn cái gì*, *công ty nào vừa có tin mới đêm qua*, *máy vừa tự đặt gì cho tôi mà tôi chưa xem*. "Số công ty theo ngành" tôi không dùng bao giờ. Nếu đội build đúng chữ trong spec thì đúng cái ngộ nhận "CRM là công cụ báo cáo" mà domain doc mục 8 cảnh báo — Sales chấm vòng 3 sẽ cho điểm thấp dù pass hết 10 test.
→ Spec nói *tối thiểu*, không cấm thêm. Bổ sung 3 khối kia vào tổng quan, **chi phí gần bằng 0** vì dữ liệu đã có.

**CT-2. Bắt buộc điền "loại công ty" lúc tạo công ty là ma sát đặt sai chỗ.**
Lúc screening tôi xem một công ty vài phút và mới chỉ biết tên + website. Ép chọn 1 trong 5 loại ngay → tôi chọn bừa "ITO khác" cho xong. Mà **loại công ty lại là đầu vào để nhóm 2 đọc tín hiệu theo góc nào** — tôi chọn bừa thì mọi phát hiện phía sau lệch. Spec ép thì phải theo, nhưng phải có đường sửa: cho nhóm 3 đề xuất sửa lại loại công ty khi bản chụp cho thấy rõ (kèm câu trích), và hiện cảnh báo mềm "loại công ty chưa xác minh".

**CT-3. Ba nút Duyệt / Sửa rồi duyệt / Bỏ — nhưng tôi có 12 gợi ý mỗi sáng thì tôi bỏ hết.**
Không có cơ chế nào ưu tiên gợi ý. Gợi ý cho công ty tôi đang chạy deal 500k USD nằm lẫn với gợi ý sửa số nhân viên của một công ty tôi đã Drop. Spec bắt hiện "hệ quả nếu thông tin này sai" cho từng cái — tốt — nhưng không bắt **sắp xếp**. Xin sắp theo: công ty có cơ hội mở trước, rồi tới mức chắc chắn.

**CT-4. "Máy tự đặt Việc tiếp theo" — chỗ này tôi sợ nhất, không phải thích nhất.**
Việc tiếp theo là thứ tôi nhìn mỗi sáng để biết làm gì. Máy ghi đè vào đó = ghi đè vào **danh sách việc của tôi**. Spec chỉ bảo vệ ô "người nhập tay và chưa tới hạn". Nghĩa là ô tôi gõ hôm qua *đã quá hạn* (vì hôm qua tôi bận) thì máy được xoá. Đúng cái ô đang nhắc tôi món nợ. Hoàn tác 7 ngày chỉ cứu được nếu tôi kịp nhìn thấy thông báo.
→ Đề nghị: máy **không đè lên ô người gõ, kể cả quá hạn**; ô người gõ đang có thì máy đẩy đề nghị sang hàng đợi nhóm 3 thay vì tự ghi. Chỗ trống và ô do máy đặt trước đó thì tự ghi thoải mái. Xem CH-4 — đây là chỗ cần ADR chứ không phải tự quyết trong lúc code.

**CT-5. Vòng quét 60s tự thêm mục vào dòng thời gian công ty của tôi.**
Dòng thời gian là chỗ tôi ghi "gặp anh Tanaka, anh ấy nói budget quý sau". Giờ nó lẫn với mục máy thêm mỗi phút. Sau 30 phút demo là 30 mục. Nhãn "do hệ thống thêm" chưa đủ — phải **lọc/gập nhóm được**, và mặc định không được đẩy mục người ghi xuống dưới màn hình. Nếu không, tính năng ấn tượng nhất với BGK lại là tính năng phá dòng thời gian của Sales.

---

### 2.2. Sales Manager — "số này tôi mang đi họp BOD được không?"

**CT-6. Tổng giá trị pipeline theo spec bị thổi phồng bởi cơ hội Tạm dừng.**
Mục 2 định nghĩa Tạm dừng là *đang mở*. Tôi báo BOD "pipeline 4 triệu USD" mà trong đó 800k là deal khách bảo "để năm sau" → mất uy tín trong một câu hỏi. Phải tách **đang chạy** vs **tạm dừng** trên màn tổng quan, hoặc ít nhất hiện chú thích. Không vi phạm spec.

**CT-7. Bảng thống kê lý do thua tính trên mẫu khuyết mà không nói.**
Spec: cơ hội Thua thiếu lý do "đứng ngoài bảng thống kê cho tới khi bổ sung". Vậy bảng hiện "40% thua vì giá" trong khi 5/8 deal thua chưa điền lý do → con số này vô nghĩa. **Bắt buộc hiện mẫu số: "n/N cơ hội thua đã có lý do".** Nguyên tắc *một dòng sai tệ hơn một dòng trống* áp cả cho số liệu tổng hợp, không chỉ cho ô dữ liệu.

**CT-8. Dashboard nhóm 6 đo hoạt động của AI, không đo cái tôi cần biết.**
Spec liệt kê: số phát hiện, phân bố mức chắc chắn, tỉ lệ duyệt/sửa/bỏ, thời gian quyết, tỉ lệ hoàn tác. Toàn chỉ số vận hành. Hai câu tôi thực sự hỏi: *(a)* AI có đang giúp Sales tiết kiệm thời gian không, *(b)* **AI sai bao nhiêu lần và ai bắt được**. Tài liệu training gọi thẳng tên chúng: **auto-accept rate** và **error-detection rate**. Số spec yêu cầu đủ để tính ra hai chỉ số này — nhưng phải **đặt đúng tên chúng trên màn hình**, không để BGK tự suy. Đây là điểm rẻ nhất trong toàn đề bài để chứng minh đội đọc tài liệu training.
Ánh xạ đề xuất: `auto-accept = Duyệt / (Duyệt + Sửa rồi duyệt + Bỏ)`; `error-detection = (Bỏ vì "thông tin sai" + Bỏ vì "hiểu sai ngữ cảnh" + số lần Hoàn tác) / tổng output AI`.

**CT-9. "Thời gian quyết trung bình" là con số dễ bị hiểu ngược.**
Thời gian quyết **thấp** có thể nghĩa là giao diện tốt, cũng có thể nghĩa là Sales bấm Duyệt mù — đúng cái bẫy "approve chỉ là đánh tráo khái niệm trách nhiệm" ở tài liệu AI-native mục 3. Con số này chỉ đọc được khi đặt cạnh error-detection rate. Đừng hiện nó một mình như một thành tích.

---

### 2.3. Tester/BA khó tính — "chỗ này chưa định nghĩa được thì chưa test được"

**CT-10. Nhóm 2 và nhóm 5 mâu thuẫn về cùng một hành vi.**
Nhóm 2: *"Việc sinh ra các phát hiện không làm thay đổi bất cứ thứ gì trong hồ sơ công ty, dòng thời gian hay cơ hội... Cho phát hiện chạy thẳng lên dòng thời gian là làm nhóm 2 thành nhóm 5."*
Nhóm 5: *đọc lại nguồn → rút phát hiện → **tự thêm** một mục vào dòng thời gian.*
Cùng động tác "rút phát hiện", một chỗ cấm ghi, một chỗ bắt ghi. Nghĩa là **việc ghi hay không phụ thuộc ai kích hoạt lượt đọc, không phụ thuộc bản thân phát hiện**. Nếu đội implement kiểu event `PhátHiệnMới → thêm timeline` thì nhóm 2 vỡ và T-4 vỡ theo. Phải mô hình hoá tường minh: phát hiện mang **ngữ cảnh kích hoạt** (`ingest thủ công` / `vòng quét`), và chỉ ngữ cảnh `vòng quét` mới được ghi.

**CT-11. Công ty vừa Đang theo dõi vừa có phát hiện mới → cùng một tin vào dòng thời gian hai lần.**
Nhóm 3 sinh gợi ý loại *"thêm một tin mới vào dòng thời gian"*. Nhóm 5 **tự thêm** mục vào đúng dòng thời gian đó. Spec không nói cái nào thắng. Kịch bản chắc chắn xảy ra trong demo: bật Đang theo dõi (T-8) cho công ty đang có gợi ý chờ (T-4/T-5) → Sales bấm Duyệt → dòng thời gian có 2 mục nội dung y hệt. BGK bắt được là mất điểm "hai nửa liền thành một sản phẩm".
→ Đề nghị luật đọc lên thành câu: **bật Đang theo dõi = uỷ quyền phần ghi tin cho hệ thống** → công ty Đang theo dõi **không** sinh gợi ý loại "thêm tin"; vẫn sinh gợi ý loại "sửa ô hồ sơ" (nhóm 5 không đụng hồ sơ). Cần ADR.

**CT-12. "Phát hiện đáng chú ý" (nhóm 4) không có định nghĩa. Đây là điều kiện kích hoạt hành vi tự chủ cao nhất của sản phẩm.**
Đáng chú ý theo mức chắc chắn nào? Loại tin nào? Một phát hiện mức **Đoán** cũng được quyền tự ghi đè Việc tiếp theo của tôi? Không định nghĩa = không test được = mỗi lần chạy ra một kết quả.
→ Đề nghị chốt cứng thành bảng: chỉ `mức ∈ {Chắc, Có thể}` **và** `loại tin ∈ {gọi vốn, nhân sự cấp cao}` mới tự đặt. Mở rộng/tuyển dụng → đẩy sang hàng đợi nhóm 3. Lý do có gốc nghiệp vụ: playbook nói cửa sổ gọi vốn tính bằng **ngày**, mở rộng/tuyển dụng tính bằng tuần — đúng tinh thần "ngày hạn phản ánh độ gấp".

**CT-13. Công ty có nhiều cơ hội mở — spec dùng số ít "cơ hội đó".**
Điều kiện là *"công ty đang có **ít nhất một** cơ hội mở"* nhưng hành động là *"tự điền cho **cơ hội đó**"*. 8 cơ hội trên 12–15 công ty → gần như chắc có công ty 2 cơ hội. Ghi hết? Ghi một? Chọn theo giá trị lớn nhất, hay giai đoạn gần chốt nhất? Không quyết → T-6 không lặp lại được.
→ Đề nghị: ghi cho **mọi cơ hội mở** của công ty (tin gọi vốn đúng là ảnh hưởng tất cả), mỗi cơ hội một bản ghi tự-đặt riêng và một nút Hoàn tác riêng. Đơn giản hơn mọi luật chọn-một và giải thích được trước BGK.

**CT-14. "Không lưu được phát hiện thiếu câu trích" chặn được ô rỗng, không chặn được câu trích bịa.**
T-2 chỉ thử ghi thẳng một phát hiện *thiếu* câu trích. Nhưng lỗi thật của LLM không phải bỏ trống — nó **paraphrase**: bản lưu viết "closed a Series B round", LLM trả câu trích "raised Series B funding". Field không rỗng → qua T-2 → nhưng bấm vào không highlight được vì không tìm thấy trong bản lưu. **Đây là lỗ thủng provenance lớn nhất của đề bài**, và luật số 1 của CLAUDE.md sập ở đúng chỗ này.
→ Ràng buộc phải là: **câu trích bắt buộc là chuỗi con nguyên văn của bản lưu, verify bằng code, vị trí do code tính (offset), không nhận offset do LLM khai.** Không khớp → từ chối cả phát hiện. Tự thêm test T-2b, không chờ BTC.

**CT-15. Mức chắc chắn tự mâu thuẫn với luật "không câu trích thì không lưu".**
Mục 2 định nghĩa **Đoán** = *"không có bằng chứng trực tiếp"*. Nhóm 2 lại cấm lưu phát hiện không câu trích. Vậy phát hiện mức Đoán tồn tại kiểu gì?
→ Cách hiểu duy nhất chạy được: câu trích luôn có (đoạn văn **gợi ra** suy đoán), thứ thay đổi là **khoảng cách giữa câu trích và câu nhận định**. Chắc = nhận định gần như trích thẳng; Có thể = suy một bước; Đoán = suy nhiều bước từ một đoạn chỉ liên quan gián tiếp. Phải viết vào ontology, nếu không mỗi người code một kiểu.

**CT-16. Ai gán mức chắc chắn? Nếu để LLM tự khai thì nó tự phong "Chắc".**
Không có cơ chế kiểm chéo trong spec. Tối thiểu: mức **Chắc** chỉ được cấp khi code kiểm được nhận định ≈ câu trích (extractive, không thêm thực thể mới). Đây cũng là ranh giới *write-down vs claim* của tài liệu AI-native mục 4.

**CT-17. "Có nội dung mới" (nhóm 5) so ở tầng nào — bản lưu hay phát hiện?**
Nếu so ở tầng **phát hiện**: LLM không tất định, cùng một trang đọc lại sinh câu chữ khác → mỗi 60 giây thêm một mục vào dòng thời gian → sau 10 phút có 10 mục rác. Demo dài 15–20 phút là lộ.
→ Phải so ở tầng **bản lưu bằng hash nội dung**, và **không gọi LLM khi hash trùng**. Vừa đúng nghiệp vụ vừa cắt phần lớn chi phí LLM. Bắt buộc, không phải tối ưu.

**CT-18. "Gợi ý đã bỏ không sinh lại... trừ khi có bản lưu mới" — vòng quét tạo bản lưu mới mỗi 60s?**
Nếu mỗi vòng đều ghi một bản lưu (kể cả nội dung y hệt) thì điều kiện "có bản lưu mới" luôn đúng → gợi ý vừa bỏ quay lại sau 60 giây, mãi mãi. T-4 không bắt được (nó chỉ kiểm hồ sơ *không đổi*). Sales chấm vòng 3 bắt được ngay.
→ Ràng buộc: **chỉ tạo bản lưu khi hash khác bản gần nhất**. Cùng một quyết định với CT-17 — chốt một lần trong ADR.

**CT-19. "Số thao tác để bỏ không được nhiều hơn số thao tác để duyệt" mâu thuẫn với "Bỏ kèm chọn lý do".**
Duyệt = 1 bấm. Bỏ = bấm Bỏ + chọn lý do = 2. Mâu thuẫn nằm trong **cùng một gạch đầu dòng** của spec.
→ Ba cách hiểu: (a) nút Bỏ mở ngay menu 5 lý do, chọn lý do **chính là** thao tác bỏ → 2 bấm nhưng 1 bước, không có màn hình trung gian; (b) đọc "thao tác" = số màn hình/bước, không phải số click; (c) Duyệt cũng thêm 1 bước xác nhận cho cân — tệ nhất, phạt người dùng đúng. Chọn (a)+(b). Ghi ADR vì đây là chỗ Sales chấm trực tiếp.

**CT-20. "Mất bao nhiêu giây kể từ lúc mở gợi ý" — "mở" là sự kiện gì?**
Spec đồng thời yêu cầu gợi ý hiện **đủ bốn thứ tại chỗ, không phải bấm sang màn khác**. Vậy không có động tác "mở". Phải định nghĩa lại mốc: tính từ lúc card lọt vào vùng nhìn, hay từ lúc mở màn hình hàng đợi. Không định nghĩa → con số ở nhóm 6 vô nghĩa.

**CT-21. T-6 có thể fail vì dữ liệu mẫu của BTC, không phải vì code.**
T-6 đòi Việc tiếp theo **tự đổi**. Nhóm 4 cấm đè lên ô người nhập tay chưa tới hạn. Nếu seed của BTC cho cơ hội đó một next step do người nhập, hạn tuần sau → hành vi đúng spec là **không đổi** → T-6 fail. Đây là **rủi ro chặn nghiệm thu nằm ngoài tầm kiểm soát của đội**. Phải hỏi BTC (Q-1) và đồng thời tự thủ: seed của đội đảm bảo có ít nhất 2 cơ hội mở với next step trống.

**CT-22. Mục 5 nói "ba ranh giới đầu" phải chặn ngoài UI, T-10 lại test ranh giới 1, 2 và 4.**
Ranh giới #3 (liên hệ khách) không có kênh nào để test — sản phẩm không có tính năng gửi thư. Ranh giới #4 (xoá dữ liệu người tạo) không nằm trong "ba ranh giới đầu" nhưng T-10 test nó.
→ Kết luận thực dụng: **chặn cả 4 ở tầng domain, đừng tin câu "ba ranh giới đầu".** Với #3, bằng chứng là "không tồn tại bất kỳ adapter gửi thư/tin nhắn nào trong mã nguồn" + một test khẳng định điều đó.

**CT-23. "Ngoài giao diện" ở T-10 chưa xác định tầng.**
Gọi HTTP API? Gọi thẳng service? Chạy SQL? Ba mức khó khác hẳn nhau. Chặn ở controller thì thua test gọi service; chặn ở service thì thua SQL trực tiếp.
→ Đề nghị hai lớp: (1) mọi thao tác ghi đi qua một **actor context**, `actor=system` không có quyền trên `stage`, `amount`, `deleted`; (2) **ràng buộc ở tầng CSDL** (trigger/constraint) cho đúng 3 trường đó. Lớp 2 là thứ trả lời được câu "một lời dặn dò suông với phần AI không tính là đã chặn". Hỏi BTC Q-2 nhưng không chờ.

**CT-24. Cờ tắt AI: runtime state hay biến môi trường?**
Nhóm 6 đòi "hiệu lực ngay, không cần chạy lại sản phẩm" → phải là state trong CSDL. Mục 7 lại đòi cấu hình (kể cả chu kỳ vòng quét) nằm ở biến môi trường. Hai câu này đá nhau với **chu kỳ vòng quét** — nhóm 6 nói chỉnh được từ dashboard và "đổi có hiệu lực ngay".
→ Cách hiểu: env là **giá trị khởi tạo**, CSDL là **giá trị đang hiệu lực**, dashboard sửa CSDL. Ghi rõ trong ADR + README, nếu không BGK đọc mục 7 sẽ tưởng đội làm sai.

**CT-25. Chồng vòng quét.** 12–15 công ty × gọi LLM, chu kỳ 60s. Một vòng chạy quá 60s thì vòng sau khởi động chồng lên → ghi trùng, đếm sai trong Nhật ký. Spec không nói. Cần khoá: đang chạy thì bỏ qua nhịp, và ghi vào nhật ký là đã bỏ nhịp.

**CT-26. Hoàn tác nhiều bậc.** Máy đặt lần 1 (đè ô trống), 3 ngày sau đặt lần 2 (đè chính giá trị máy đặt lần 1). Bấm Hoàn tác trả về đâu? Cửa sổ 7 ngày đếm từ lần nào? T-7 chỉ test một bậc.
→ Đề nghị: Hoàn tác luôn trả về **giá trị người-gõ gần nhất** (hoặc rỗng nếu chưa từng có), không phải giá trị máy đặt trước đó. Mục đích của nút này là bảo vệ dữ liệu người, không phải làm lịch sử phiên bản.

**CT-27. Hết 7 ngày verify kiểu gì trong một ngày demo?** Không có cách tua thời gian → điều khoản "hết 7 ngày nút biến mất" không kiểm chứng được bằng tay. Cần test đơn vị với đồng hồ tiêm vào, và nói trước với BGK.

**CT-28. Xoá công ty đang có bản lưu / phát hiện / gợi ý / bản ghi tự-đặt.** Cascade thì metric nhóm 6 hụt đi và mâu thuẫn tinh thần "dữ liệu đã sinh không bị xoá". Giữ lại thì có phát hiện mồ côi. → soft-delete công ty, metric tính trên bản ghi lịch sử.

**CT-29. Reset seed "về đúng trạng thái ban đầu".** Phải xoá cả bản lưu/phát hiện/gợi ý/thông báo/nhật ký vòng quét sinh trong lúc demo **và** đưa mọi công ty về bản chụp "trước". Dễ quên vế sau → giám khảo diễn lại lần hai thì không có gì xảy ra.

**CT-30. Đủ điều kiện: "chỗ ghi nguồn" cho hai ô dấu hiệu — free text hay trỏ tới phát hiện?**
Nếu trỏ được tới một phát hiện có sẵn của công ty thì qualify trở thành fact-based đúng tinh thần playbook mục 3, và đây là chỗ nối nhóm 1 với nhóm 2 rẻ nhất. Nếu là free text thì chỉ là một ô chữ. Đề nghị: free text **+ tuỳ chọn** đính một phát hiện.

**CT-31. Tắt AI trong lúc hàng đợi còn gợi ý chờ.** Còn duyệt được không? Duyệt là hành vi của **người**, không phải AI, và "dữ liệu đã sinh không bị xoá" → nên còn duyệt được. Spec im lặng. T-9 không cover. Chốt và ghi.

**CT-32. Nhật ký "mỗi 10 vòng ghi thêm một dòng tổng hợp cộng dồn"** — cộng dồn từ đầu hay của 10 vòng gần nhất? Nhỏ, nhưng phải chọn để test viết được.

---

### 2.4. Người bảo vệ dữ liệu — "một dòng sai tệ hơn một dòng trống"

**CT-33. Kiểm kê chỗ AI được ghi — đề bài mở rộng hơn luật số 3 của CLAUDE.md.**

| Chỗ AI ghi | Ai duyệt | Sai thì phát hiện bằng cách nào | Sửa lại dễ hơn lúc máy làm? |
| --- | --- | --- | --- |
| Bản lưu, phát hiện (n2) | Không ai | Bấm ra câu trích | Không cần sửa — vùng đọc |
| Hồ sơ công ty, tin timeline (n3) | Người, từng cái | Đối chiếu câu trích tại chỗ | ✅ không duyệt thì không có gì xảy ra |
| **Việc tiếp theo + ngày hạn (n4)** | **Không ai** | Thông báo trong sản phẩm | ⚠️ Hoàn tác 1 bấm, **chỉ 7 ngày** |
| **Mục dòng thời gian (n5)** | **Không ai** | Chỉ khi Sales tự đọc dòng thời gian | ⚠️ xoá tay từng mục, **không có Hoàn tác** |

→ **CLAUDE.md mục 4 hiện ghi "AI không bao giờ tự ghi vào dữ liệu chính thức". Đề bài yêu cầu ngược lại ở hai chỗ.** Rule file của đội đang mâu thuẫn với Specs — phải sửa bảng trần tự chủ trong CLAUDE.md + `docs/ontology.md` **trước khi code**, nếu không mọi review nội bộ sẽ tranh cãi vô ích và BGK vòng 2 hỏi trúng thì đội tự mâu thuẫn với chính rule file mình treo.

**CT-34. Nhóm 5 là chỗ yếu nhất về khả năng phát hiện sai.** Nhóm 4 có thông báo đẩy vào mặt người dùng. Nhóm 5 **không có thông báo nào** — chỉ có Nhật ký vòng quét mà Sales không xem, và dashboard mà Sales không thấy. Máy ghi sai vào dòng thời gian thì cơ chế phát hiện duy nhất là Sales tình cờ đọc. Đo error-detection rate ở nhóm 5 sẽ luôn ra ~0, và ~0 ở đây không có nghĩa là máy đúng.
→ Đề nghị tối thiểu (rẻ): trên màn hình công ty hiện đếm "N mục do hệ thống thêm chưa xem", và cho xoá một mục kèm **một lý do ngắn** — biến thao tác xoá thành tín hiệu đo được. Không có nó thì nhóm 5 là vùng mù hoàn toàn.

**CT-35. Xoá mục timeline do máy thêm thì phát hiện gốc còn không?**
Phải còn — nó là claim, và metric dựa vào nó. Nhưng khi đó quan hệ giữa "mục timeline" và "phát hiện" phải gọi được thành câu ("mục timeline **được sinh từ** phát hiện"), và việc xoá mục phải ghi vết chứ không im lặng. Nếu xoá cả phát hiện thì mất luôn provenance của những thứ khác trỏ vào nó.

**CT-36. Ngày hạn do máy đặt là một con số máy bịa ra và không có nguồn.**
Spec bắt nội dung Việc tiếp theo kèm câu trích — tốt. Nhưng **ngày hạn thì không có provenance**: "gọi vốn → hạn 3 ngày" đến từ đâu? Nếu để LLM tự chọn ngày thì mỗi lần một khác, không giải thích được, và vi phạm luật số 1 theo nghĩa rộng.
→ Ngày hạn phải đến từ **một bảng cấu hình đọc được** (loại tin → số ngày), là một mảnh playbook theo nghĩa tài liệu AI-native mục 6. Hiện được lý do trên giao diện: *"hạn 3 ngày vì tin gọi vốn có cửa sổ tính bằng ngày"*.

**CT-37. Không có gì chặn AI đề xuất sửa các ô định danh của hồ sơ công ty.**
Nhóm 3 nói "điền hoặc sửa một ô còn trống hoặc đã cũ" — không giới hạn ô nào. Cho phép đề xuất đổi **tên công ty** hoặc **loại công ty** là mở cửa cho vòng lặp tự tham chiếu (loại công ty là đầu vào để đọc tín hiệu → sửa loại → đọc lại khác đi). Cần whitelist ô được đề xuất, ghi trong ontology.

**CT-38. Không có retention cho bản lưu.** Vòng quét 60s. Nếu ghi mỗi nhịp thì một đêm là ~1400 bản lưu/công ty. CT-17/CT-18 (chỉ ghi khi hash khác) giải quyết luôn cả cái này — thêm một lý do nữa để chốt nó thành ràng buộc cứng.

---

## 3. Điểm mơ hồ trong Specs

| # | Chỗ mơ hồ | Cách hiểu A | Cách hiểu B | Ảnh hưởng nếu chọn sai |
| --- | --- | --- | --- | --- |
| M-1 | "Phát hiện đáng chú ý" (n4) | Mọi phát hiện mới | Chỉ Chắc/Có thể + loại tin gấp | A: máy tự ghi đè dựa trên phỏng đoán → vỡ luật "một dòng sai tệ hơn dòng trống", Sales mất tin |
| M-2 | Công ty nhiều cơ hội mở (n4) | Ghi cho mọi cơ hội mở | Chọn 1 theo luật ưu tiên | B: luật ưu tiên không có trong spec → T-6 không lặp lại được, khó giải trình vòng 2 |
| M-3 | "Có nội dung mới" (n5) | Diff ở tầng phát hiện | Hash ở tầng bản lưu | A: LLM không tất định → spam timeline mỗi 60s, lộ ngay trong demo |
| M-4 | Bản lưu tạo mỗi vòng? | Mỗi nhịp một bản lưu | Chỉ khi hash khác | A: gợi ý đã Bỏ sinh lại mỗi phút; phình dữ liệu |
| M-5 | Công ty Đang theo dõi có sinh gợi ý "thêm tin"? | Có (n3 + n5 song song) | Không, n5 thay n3 phần ghi tin | A: dòng thời gian trùng nội dung 2 lần |
| M-6 | Đè lên next step người gõ **đã quá hạn** | Được (spec chỉ cấm "chưa tới hạn") | Không đè, đẩy sang hàng đợi | A: xoá mất món nợ Sales đang giữ; đúng chữ nhưng sai tinh thần "Sales sở hữu dữ liệu" |
| M-7 | "Ngoài giao diện" (T-10) | Gọi HTTP API | Gọi thẳng tầng service/CSDL | A: chặn ở controller, BGK gọi service là thủng → mất T-10 |
| M-8 | Câu trích: nguyên văn hay diễn đạt lại | Field khác rỗng là đủ | Bắt buộc là chuỗi con của bản lưu | A: provenance giả, bấm vào không highlight được → vỡ luật số 1 |
| M-9 | Mức "Đoán" vs cấm lưu thiếu câu trích | Đoán = không câu trích (không lưu được) | Luôn có câu trích, khác nhau ở khoảng cách suy luận | A: mức Đoán không tồn tại → spec mục 2 thành chữ chết |
| M-10 | Chu kỳ vòng quét: env hay CSDL | Chỉ env (mục 7) | env khởi tạo, CSDL hiệu lực (n6) | A: không chỉnh được từ dashboard → hỏng yêu cầu nhóm 6 |
| M-11 | Bỏ = 2 thao tác vs "không nhiều hơn Duyệt" | Thêm bước xác nhận cho Duyệt | Bỏ mở menu lý do tại chỗ, 1 bước | A: phạt người dùng khi họ làm đúng; Sales chấm thấp |
| M-12 | Tắt AI thì hàng đợi còn duyệt được? | Khoá luôn | Còn duyệt (duyệt là việc của người) | A: mất dữ liệu công việc đang dở, không có trong yêu cầu |
| M-13 | "Mở gợi ý" để đo thời gian quyết | Bấm vào card | Card vào vùng nhìn / mở màn hàng đợi | A: mọi thời gian = 0 vì không ai phải bấm mở |
| M-14 | Ô hồ sơ nào AI được đề xuất sửa | Mọi ô | Whitelist, cấm tên + loại công ty | A: vòng lặp tự tham chiếu qua loại công ty |
| M-15 | Quản trị có thao tác CRM không | Chỉ xem dashboard | Toàn quyền + dashboard | Nhẹ; nhưng phải chốt để viết đăng nhập & test |

---

## 4. Edge case & rủi ro tự phát hiện

**Bắt buộc xử lý trước feature freeze (tối 14/08)** — vỡ cái nào cũng mất test hoặc mất niềm tin:

| # | Edge case | Vì sao bắt buộc |
| --- | --- | --- |
| E-1 | Câu trích LLM diễn đạt lại → không tìm thấy trong bản lưu | Vỡ luật số 1 + T-3. Chặn bằng verify chuỗi con, offset do code tính |
| E-2 | Vòng quét sinh mục timeline lặp vô hạn do LLM không tất định | Lộ trong 10 phút demo. Chặn bằng hash bản lưu |
| E-3 | Gợi ý đã Bỏ sinh lại mỗi 60s | Sales chấm vòng 3 sẽ bắt. Cùng một fix với E-2 |
| E-4 | Timeline trùng nội dung (n3 duyệt + n5 tự thêm) | Kịch bản demo T-4/T-5 + T-8 chạy cạnh nhau chắc chắn gặp |
| E-5 | T-6 fail vì seed BTC có next step chưa tới hạn | Rủi ro ngoài tầm kiểm soát → hỏi BTC + seed thủ của đội |
| E-6 | Ranh giới chỉ chặn ở tầng giao diện/controller | Mất T-10, và mất luôn điểm governance vòng 2 |
| E-7 | Vòng quét chồng nhịp khi 1 vòng > 60s | Ghi trùng + Nhật ký sai số → T-8 chập chờn |
| E-8 | Máy đè lên next step người gõ đã quá hạn | Mất dữ liệu người dùng thật. Quyết trong ADR trước khi code n4 |
| E-9 | Reset seed không đưa bản chụp về "trước" | Giám khảo diễn lại lần 2 thì không có gì xảy ra → hỏng cả kịch bản demo |
| E-10 | Cờ tắt AI để ở env → không tắt được lúc chạy | Mất T-9 |
| E-11 | Bản lưu tiếng Nhật/Hàn: offset ký tự Unicode, highlight lệch | Thị trường JP/KR là bối cảnh đề bài; lệch highlight = mất T-3 |
| E-12 | Mạng/LLM lỗi giữa demo | Phải ghi "nguồn không đọc được", không đoán (n2 đã yêu cầu) và vòng quét không được chết |

**Bỏ được nếu thiếu thời gian** (ghi vào phần hạn chế đã biết, đừng giấu):

- E-13 Hoàn tác nhiều bậc (CT-26) — làm một bậc, ghi rõ giới hạn.
- E-14 Verify hết hạn cửa sổ 7 ngày bằng tay (CT-27) — thay bằng test đơn vị với đồng hồ tiêm.
- E-15 Soft-delete công ty (CT-28) — chấp nhận cascade nếu kịp thời gian không đủ, nhưng phải nói ra.
- E-16 Lọc/gập mục hệ thống trên timeline (CT-5) — có thì hơn.
- E-17 Retention bản lưu (CT-38) — đã được E-2 giải quyết gián tiếp.
- E-18 Race giữa vòng quét và người đang sửa — 1 tài khoản Sales, xác suất thấp.

---

## 5. User stories + acceptance criteria (chỉ phần lõi)

Ký hiệu đối tượng: **O**=Observation (bản lưu) · **C**=Claim (phát hiện) · **P**=Proposal (gợi ý) · **CRM**=dữ liệu chính thức (hồ sơ/timeline/cơ hội).

**US-1 — Rút phát hiện có bằng chứng kiểm được** *(chạm O, C)*
Là hệ thống, khi đọc một bản chụp, tôi tạo bản lưu nguyên văn và rút các phát hiện, để nhóm 3/4/5 có nguyên liệu.
- AC1: bản lưu lưu nguyên văn + địa chỉ nguồn + thời điểm đọc, thuộc đúng 1 công ty.
- AC2: **chỉ tạo bản lưu mới khi hash nội dung khác bản gần nhất**; trùng thì ghi nhận "đã đọc, không đổi" vào nhật ký, không tạo bản lưu, **không gọi LLM**. *(E-2, E-3)*
- AC3: phát hiện không có câu trích → từ chối lưu (T-2).
- AC4: **câu trích không phải chuỗi con nguyên văn của bản lưu → từ chối lưu**; offset do code tính, không nhận từ LLM. *(E-1 — test T-2b của đội)*
- AC5: mỗi phát hiện có loại tin ∈ enum, mức chắc chắn ∈ {Chắc, Có thể, Đoán}, phân biệt được bằng ký hiệu+màu.
- AC6: câu nhận định nêu được góc **loại công ty** đang đọc.
- AC7: tạo phát hiện **không** phát sinh ghi nào vào CRM. *(CT-10)*
- AC8: nguồn lỗi → ghi "không đọc được", không sinh phát hiện.

**US-2 — Bấm vào nhận định thấy đúng câu nguồn** *(chạm C→O qua provenance)*
- AC1: bấm phát hiện ở bất kỳ đâu (khu vùng đọc, gợi ý, ô next step do máy đặt, mục timeline do máy thêm) → mở bản lưu, cuộn tới và **đánh dấu** đúng đoạn (T-3).
- AC2: một phát hiện có thể được trỏ tới từ nhiều nơi; xoá nơi trỏ không xoá phát hiện. *(CT-35)*

**US-3 — Duyệt gợi ý cập nhật hồ sơ** *(chạm C→P→CRM)*
- AC1: mỗi gợi ý hiện tại chỗ: hiện tại→đề nghị, câu trích, mức chắc chắn, một dòng hệ quả nếu sai.
- AC2: Duyệt 1 bước; **Bỏ mở menu 5 lý do tại chỗ, không màn hình trung gian** *(M-11)*.
- AC3: không thao tác → hồ sơ y nguyên qua ≥3 chu kỳ vòng quét (T-4).
- AC4: **Sửa rồi duyệt đếm riêng**, không cộng vào Duyệt (T-5).
- AC5: mỗi quyết định lưu: nội dung, ai, lúc nào, quyết gì, lý do, thời gian quyết (mốc bắt đầu = mở màn hàng đợi *(M-13)*).
- AC6: gợi ý đã Bỏ không sinh lại cùng nội dung trừ khi **có bản lưu mới theo AC2 của US-1**.
- AC7: công ty đang bật Đang theo dõi **không** sinh gợi ý loại "thêm tin" *(M-5)*.
- AC8: chỉ đề xuất sửa ô trong whitelist; cấm tên công ty và loại công ty *(M-14)*.

**US-4 — Máy tự đặt Việc tiếp theo, sai thì một cú bấm** *(chạm C→CRM, không qua P)*
- AC1: kích hoạt khi phát hiện có `mức ∈ {Chắc, Có thể}` **và** `loại ∈ {gọi vốn, nhân sự cấp cao}`, công ty có ≥1 cơ hội mở *(M-1)*.
- AC2: ghi cho **mọi** cơ hội mở của công ty, mỗi cơ hội một bản ghi + một nút Hoàn tác *(M-2)*.
- AC3: nội dung nhắc sự kiện kích hoạt + kèm câu trích bấm ra được.
- AC4: ngày hạn lấy từ **bảng cấu hình loại tin → số ngày**, hiện lý do trên giao diện *(CT-36)*.
- AC5: **không đè lên ô do người gõ, kể cả đã quá hạn** — trường hợp đó đẩy sang hàng đợi nhóm 3 *(M-6, cần ADR)*.
- AC6: ô do máy đặt có dấu hiệu phân biệt; thông báo tồn tại tới khi được xem.
- AC7: Hoàn tác 1 bấm, trong 7 ngày, cửa sổ hiện rõ; trả về **giá trị người-gõ gần nhất hoặc rỗng** *(CT-26)*.
- AC8: ghi vết cả lần tự đặt lẫn lần hoàn tác; tỉ lệ hoàn tác lên dashboard (T-6, T-7).

**US-5 — Vòng quét tự chạy trên công ty Đang theo dõi** *(chạm O→C→CRM)*
- AC1: bật/tắt nhãn 1 thao tác; có màn danh sách riêng.
- AC2: mỗi vòng: đọc lại → hash → khác thì tạo bản lưu + rút phát hiện + **tự thêm mục timeline** nhãn "do hệ thống thêm" kèm câu trích; trùng thì không làm gì.
- AC3: **không dừng chờ duyệt ở bất kỳ bước nào**.
- AC4: chu kỳ cấu hình được, mặc định 60s; **đang chạy thì bỏ nhịp kế và ghi nhận đã bỏ** *(E-7)*.
- AC5: mỗi vòng ghi 1 dòng nhật ký (thời điểm, số công ty, số nội dung mới, số mục đã thêm, thời lượng, lỗi); mỗi 10 vòng thêm 1 dòng cộng dồn (T-8).
- AC6: Sales xoá được mục do máy thêm; **xoá có ghi lý do ngắn** để đo *(CT-34)*.

**US-6 — Phanh của Quản trị** *(chạm cấu hình + toàn bộ)*
- AC1: một cờ trong CSDL tắt sạch: vòng quét dừng, không phát hiện mới, không gợi ý mới, không tự đặt; dữ liệu đã sinh còn nguyên (T-9).
- AC2: Sales thấy dòng thông báo AI đang tắt.
- AC3: **hàng đợi vẫn duyệt được khi AI tắt** *(M-12)* — duyệt là hành vi của người.
- AC4: chỉnh chu kỳ có hiệu lực ngay; env là giá trị khởi tạo, CSDL là giá trị hiệu lực *(M-10)*.
- AC5: mỗi lần bật/tắt có ghi vết.
- AC6: dashboard hiện **auto-accept rate** và **error-detection rate** đúng tên *(CT-8)*.

**US-7 — Ranh giới chặn ở tầng dưới giao diện** *(chạm mọi thứ)*
- AC1: mọi thao tác ghi mang `actor`; `actor=system` bị từ chối trên `stage`, `amount`, xoá dữ liệu người tạo.
- AC2: ràng buộc lặp lại ở tầng CSDL cho 3 trường đó *(M-7)*.
- AC3: test gọi thẳng tầng service với `actor=system` → cả 3 bị từ chối (T-10).
- AC4: mã nguồn không có adapter gửi thư/tin nhắn nào; có test khẳng định *(CT-22)*.

---

## 6. Câu hỏi cần BTC / end user trả lời

| # | Câu hỏi | Vì sao chặn | Tự thủ nếu không có trả lời |
| --- | --- | --- | --- |
| Q-1 | Bộ dữ liệu 15/08 có bảo đảm ít nhất một cơ hội **mở** với Việc tiếp theo **trống hoặc quá hạn** không? | T-6 có thể fail vì dữ liệu, không vì code *(E-5)* | Seed của đội tự bảo đảm; viết T-6 chọn cơ hội thoả điều kiện thay vì cơ hội cố định |
| Q-2 | "Không đi qua giao diện người dùng" ở T-10 nghĩa là tầng nào — HTTP API, tầng service, hay SQL trực tiếp? | Quyết định chặn ở đâu *(M-7)* | Chặn cả actor context lẫn ràng buộc CSDL |
| Q-3 | Bản chụp là HTML thô hay text? Ngôn ngữ gì (JP/EN)? Có đánh dấu sẵn chỗ "tin mới" không? | Ảnh hưởng cách tính offset và highlight *(E-11)* | Chuẩn hoá về text khi ingest, lưu cả bản gốc |
| Q-4 | Bộ dữ liệu có kèm sẵn phát hiện/gợi ý mẫu, hay chỉ CRM + bản chụp? | Nếu chỉ bản chụp thì mọi metric bắt đầu từ 0, demo phải chạy trước vài vòng | Giả định chỉ có CRM + bản chụp |
| Q-5 | Gọi LLM ngoài trong phòng thi: có giới hạn mạng/chi phí? Nếu mạng chết, fallback theo luật có bị trừ điểm "không AI-native" không? | Quyết định có làm đường lui hay không *(E-12)* | Có fallback, ghi rõ là fallback, không giấu |
| Q-6 | Tài khoản Quản trị có thao tác CRM được không hay chỉ xem dashboard? | Viết đăng nhập + phân quyền + test *(M-15)* | Quản trị xem được CRM, không sửa |
| Q-7 | "Sửa rồi duyệt" BTC muốn tính vào auto-accept rate thế nào? | Con số này BGK sẽ hỏi ở vòng 2 | Loại khỏi tử số, hiện tách bạch cả 3 tỉ lệ |
| Q-8 | Vòng 3 Sales chấm bằng chính bộ dữ liệu BTC hay dữ liệu của họ? | Nếu dữ liệu lạ thì phải có đường nạp bản chụp tuỳ ý | Có màn nạp bản chụp thủ công trong bảng Quản trị |

---

## 7. Đề xuất cắt scope — nếu chỉ làm được 40%

**Nguyên tắc cắt:** giữ thứ (a) chặn nghiệm thu, (b) là kiến trúc không thể thêm sau, (c) Sales chấm trực tiếp. Cắt thứ đắt mà chỉ đổi được 1 test.

**Làm bằng mọi giá (≈40%) — theo thứ tự:**

1. **US-7 ranh giới + actor context** — không phải feature mà là kiến trúc. Làm sau thì phải sửa mọi đường ghi. Đổi lấy T-10 và toàn bộ điểm governance vòng 2.
2. **Nhóm 1 CRM làm tay** — không có thì không phải CRM, mất T-1, và mất luôn câu "tắt AI vẫn chạy đủ" vốn là nửa đầu của đề bài.
3. **Nhóm 2 + provenance verify chuỗi con** — nền của mọi nhóm sau. Không có nó thì nhóm 3/4/5 đều là "máy nói thế". T-2, T-3.
4. **Nhóm 6 nút tắt + 2 chỉ số đúng tên** — rẻ nhất trong toàn đề bài (một cờ + một màn hình đọc), đổi lấy T-9 và bằng chứng governance.
5. **Nhóm 4 tự đặt Việc tiếp theo + Hoàn tác** — T-6, T-7. Đây là phần **gây ấn tượng mạnh nhất** vì nó chạm đúng "next step là nhịp tim của deal", và là chỗ duy nhất trong đề bài AI được tự chủ mà vẫn an toàn nhờ Hoàn tác.

**Cắt trước nếu hết giờ, theo thứ tự cắt:**

6. **Nhóm 5 vòng quét** — đắt nhất (scheduler + khoá nhịp + nhật ký + chống lặp) mà chỉ đổi 1 test (T-8). Nếu buộc phải làm tối giản: chạy vòng quét **thủ công một nút "chạy một vòng"** + nhật ký đầy đủ, nói rõ đây là bản rút gọn. Vẫn demo được vòng khép kín.
7. **Nhóm 3 hàng đợi gợi ý** — 2 test (T-4, T-5) nhưng là chỗ duy nhất đo auto-accept rate. **Không cắt hẳn**: nếu hết giờ thì làm 1 loại gợi ý duy nhất ("thêm tin vào timeline"), bỏ loại "sửa ô hồ sơ" — giảm quá nửa công việc mà vẫn giữ đủ vòng đo.

**Không bao giờ cắt dù nhỏ:** verify câu trích là chuỗi con (E-1), hash bản lưu (E-2/E-3), reset seed đưa bản chụp về "trước" (E-9). Ba thứ này rẻ và mỗi thứ đều có thể một mình phá cả buổi demo.

---

## 8. Việc phải làm ngay (trước khi gõ dòng code đầu tiên)

1. **Sửa CLAUDE.md mục 4** — bảng trần tự chủ đang nói "AI không bao giờ tự ghi vào dữ liệu chính thức", đề bài yêu cầu ngược ở nhóm 4 và nhóm 5. Rule file mâu thuẫn Specs là điểm chết ở vòng 2 *(CT-33)*.
2. **Sinh `docs/ontology.md`** từ template: ánh xạ bản lưu→Observation, phát hiện→Claim, gợi ý→Proposal, câu trích+offset→Provenance; đặt tên quan hệ; ghi whitelist ô được đề xuất; ghi bảng loại tin → số ngày hạn.
3. **Chốt ADR** cho: M-1, M-2, M-3+M-4 (một ADR chung về "khi nào tạo bản lưu"), M-5, M-6, M-7, M-8.
4. **Gửi Q-1..Q-8 cho BTC** — Q-1 và Q-2 gấp nhất.

---

## Câu hỏi chưa giải quyết

- Stack vẫn TBD → chặn ontology chi tiết (kiểu dữ liệu, enum) và bộ test một lệnh.
- Chưa biết BTC có phát bản chụp dạng HTML hay text → chưa chốt được cách tính offset (Q-3).
- Chưa rõ ai trong đội làm phần nào → chưa chia được file ownership cho việc chạy song song.
- Chưa xác minh telemetry Grafana thật sự nhận dữ liệu (README ghi "chưa verify") — đây vẫn là điều kiện qua vòng 1.
